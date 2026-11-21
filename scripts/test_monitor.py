#!/usr/bin/env python3
import unittest, tempfile, pathlib, json, threading, urllib.request, time
from unittest.mock import patch
import work_monitor as monitor

class QuotaTests(unittest.TestCase):
    def test_threshold_and_real_reset(self):
        self.assertIsNone(monitor.decision({'primary':{'used_percent':89,'resets_at':1000}},100))
        self.assertEqual(monitor.decision({'primary':{'used_percent':90,'resets_at':1000}},100),1060)
    def test_secondary_does_not_delay_primary_resume(self):
        self.assertEqual(monitor.decision({'primary':{'used_percent':95,'resets_at':1000},'secondary':{'used_percent':91,'resets_at':5000}},100),1060)
    def test_secondary_alone_never_pauses(self):
        self.assertIsNone(monitor.decision({'secondary':{'used_percent':99,'resets_at':5000}},100))
    def test_pending_weekly_timer_moves_to_real_primary_reset(self):
        timer={'resume_at':5060,'sent':False,'close_requested':True}
        moved=monitor.primary_timer(timer,{'primary':{'used_percent':88,'resets_at':1000}},100)
        self.assertEqual(moved['resume_at'],1060)
        self.assertTrue(moved['close_requested'])
        self.assertEqual(monitor.primary_timer(moved,{},100),moved)
        sent=dict(timer,sent=True)
        self.assertEqual(monitor.primary_timer(sent,{'primary':{'resets_at':1000}},100),sent)
    def test_expired_and_unknown_windows_do_not_invent_quota(self):
        self.assertIsNone(monitor.decision({'primary':{'used_percent':99,'resets_at':50}},100))
        self.assertIsNone(monitor.decision({},100))
    @patch.object(monitor,'event')
    @patch.object(monitor.subprocess,'run')
    def test_resume_warning_is_recorded_as_failure(self,run,event):
        run.return_value=type('Result',(),{'returncode':0,'stdout':'queued','stderr':'warning: failed to resume'})()
        self.assertFalse(monitor.queue('test-thread','test-message',True))
        self.assertIn('--resume',run.call_args.args[0])

class FeedbackTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.runtime = pathlib.Path(self.temp.name)
        self.patch = patch.object(monitor, 'RUNTIME', self.runtime)
        self.patch.start()
    def tearDown(self):
        self.patch.stop()
        self.temp.cleanup()
    def append(self, message='feedback', **extra):
        row = dict(time='2026-11-20T00:00:00Z', message=message, **extra)
        with (self.runtime/'feedback.jsonl').open('a') as f: f.write(json.dumps(row)+'\n')
        return row
    @patch.object(monitor, 'queue', return_value=True)
    def test_primary_pause_keeps_feedback_and_releases_once_after_real_reset(self, queue):
        self.append('durante pausa', id='paused')
        monitor.atomic_json(self.runtime/'usage.json', dict(status='winding_down', primary=dict(used_percent=97,resets_at=1000)))
        for now in (100,101):
            with patch.object(monitor.time,'time',return_value=now): monitor.deliver_feedback('thread')
        self.assertEqual(queue.call_count,0)
        self.assertEqual(monitor.feedback_rows()[0]['delivery'],'waiting_reset')
        with patch.object(monitor.time,'time',return_value=1001): monitor.deliver_feedback('thread')
        monitor.deliver_feedback('thread')
        self.assertEqual(queue.call_count,1)
        self.assertEqual(monitor.feedback_rows()[0]['delivery'],'queued')
        self.assertIn('durante pausa',queue.call_args.args[1])
    @patch.object(monitor, 'queue', return_value=True)
    def test_banked_reset_releases_feedback_and_secondary_never_blocks_it(self, queue):
        self.append()
        monitor.atomic_json(self.runtime/'usage.json', dict(primary=dict(used_percent=95,resets_at=5000)))
        with patch.object(monitor.time,'time',return_value=100): monitor.deliver_feedback('thread')
        self.assertFalse(queue.called)
        monitor.atomic_json(self.runtime/'usage.json', dict(primary=dict(used_percent=2,resets_at=5000),secondary=dict(used_percent=99,resets_at=9000)))
        with patch.object(monitor.time,'time',return_value=101): monitor.deliver_feedback('thread')
        self.assertEqual(queue.call_count,1)
    @patch.object(monitor, 'queue', return_value=True)
    def test_secondary_warns_once_and_rearms_after_banked_reset(self, queue):
        low={'secondary':{'used_percent':90,'resets_at':5000}}
        monitor.warn_secondary('thread',low,100)
        monitor.warn_secondary('thread',low,101)
        self.assertEqual(queue.call_count,1)
        monitor.warn_secondary('thread',{'secondary':{'used_percent':5,'resets_at':5000}},102)
        monitor.warn_secondary('thread',low,103)
        self.assertEqual(queue.call_count,2)
    @patch.object(monitor, 'queue', return_value=True)
    def test_delivery_works_while_active_and_after_completion_without_duplicates(self, queue):
        for status in ('working', 'waiting_reset', 'complete'):
            monitor.atomic_json(self.runtime/'usage.json', dict(status=status))
            if status=='complete': (self.runtime/'PROJECT_COMPLETE').touch()
            self.append(status)
            monitor.deliver_feedback('same-thread')
            monitor.deliver_feedback('same-thread')
        self.assertEqual(queue.call_count, 3)
        self.assertTrue((self.runtime/'PROJECT_COMPLETE').exists())
        self.assertTrue(all(r['delivery']=='queued' for r in monitor.feedback_rows()))
        for call in queue.call_args_list:
            self.assertEqual(call.args[0], 'same-thread')
            self.assertTrue(call.kwargs['resume'])
            self.assertTrue(call.kwargs['accept_resume_warning'])
    @patch.object(monitor, 'queue', side_effect=[False, True])
    def test_failed_delivery_is_retried_and_survives_restart(self, queue):
        self.append()
        with patch.object(monitor.time, 'time', return_value=100): monitor.deliver_feedback('thread')
        with patch.object(monitor.time, 'time', return_value=101): monitor.deliver_feedback('thread')
        self.assertEqual(queue.call_count, 1)
        self.assertEqual(monitor.feedback_rows()[0]['delivery'], 'pending')
        with patch.object(monitor.time, 'time', return_value=131): monitor.deliver_feedback('thread')
        monitor.deliver_feedback('thread')
        self.assertEqual(queue.call_count, 2)
        self.assertEqual(monitor.feedback_rows()[0]['delivery'], 'queued')
    @patch.object(monitor, 'queue', return_value=True)
    def test_concurrent_delivery_serializes_and_read_legacy_rows_stay_reviewed(self, queue):
        old=self.append('already reviewed')
        monitor.atomic_json(self.runtime/'feedback-delivery.json', {monitor.feedback_id(old): dict(status='reviewed')})
        self.append('new', id='stable-id')
        threads=[threading.Thread(target=monitor.deliver_feedback,args=('thread',)) for _ in range(3)]
        for thread in threads: thread.start()
        for thread in threads: thread.join()
        self.assertEqual(queue.call_count, 1)
        self.assertEqual(monitor.feedback_rows()[0]['delivery'], 'reviewed')
    @patch.object(monitor, 'queue', return_value=True)
    def test_real_http_post_wakes_delivery_and_assigns_unique_ids(self, queue):
        server=monitor.ThreadingHTTPServer(('127.0.0.1',0), monitor.Handler)
        serving=threading.Thread(target=server.serve_forever,daemon=True); serving.start()
        delivery=threading.Thread(target=monitor.feedback_watch,args=('thread',),daemon=True); delivery.start()
        try:
            url='http://127.0.0.1:'+str(server.server_port)+'/api/feedback'
            request=urllib.request.Request(url, data=json.dumps(dict(message='desde HTTP')).encode(), headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.status,201)
                self.assertTrue(json.load(response)['id'])
            deadline=time.monotonic()+2
            while not queue.called and time.monotonic()<deadline: time.sleep(.01)
            self.assertEqual(queue.call_count,1)
        finally:
            (self.runtime/'STOP').touch(); monitor.FEEDBACK_WAKE.set()
            delivery.join(2); server.shutdown(); serving.join(2); server.server_close()
        self.assertEqual(monitor.feedback_rows()[0]['delivery'],'queued')
    @patch.object(monitor,'event')
    @patch.object(monitor.subprocess,'run')
    def test_queue_acceptance_is_not_retried_for_resume_warning(self, run, event):
        run.return_value=type('Result',(),{'returncode':0,'stdout':'queued','stderr':'warning: already active'})()
        self.assertTrue(monitor.queue('thread','feedback',True,accept_resume_warning=True))

if __name__=='__main__': unittest.main()

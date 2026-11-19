#!/usr/bin/env python3
import unittest
from unittest.mock import patch
import work_monitor as monitor

class QuotaTests(unittest.TestCase):
    def test_threshold_and_real_reset(self):
        self.assertIsNone(monitor.decision({'primary':{'used_percent':89,'resets_at':1000}},100))
        self.assertEqual(monitor.decision({'primary':{'used_percent':90,'resets_at':1000}},100),1060)
    def test_weekly_window_can_delay_resume(self):
        self.assertEqual(monitor.decision({'primary':{'used_percent':95,'resets_at':1000},'secondary':{'used_percent':91,'resets_at':5000}},100),5060)
    def test_expired_and_unknown_windows_do_not_invent_quota(self):
        self.assertIsNone(monitor.decision({'primary':{'used_percent':99,'resets_at':50}},100))
        self.assertIsNone(monitor.decision({},100))
    @patch.object(monitor,'event')
    @patch.object(monitor.subprocess,'run')
    def test_resume_warning_is_recorded_as_failure(self,run,event):
        run.return_value=type('Result',(),{'returncode':0,'stdout':'queued','stderr':'warning: failed to resume'})()
        self.assertFalse(monitor.queue('test-thread','test-message',True))
        self.assertIn('--resume',run.call_args.args[0])

if __name__=='__main__': unittest.main()

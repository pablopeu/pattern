import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Link2, Share2, Trash2, X } from 'lucide-react';
import type { Studio } from '../app/useStudio';
import { Modal } from './Modal';
import {
  deleteShare,
  documentHash,
  forgetPublished,
  publishedFor,
  publishShare,
  secretFor,
} from '../share/api';
import { byteLength, gzipSize, shareDocument } from '../share/document';
import { renderSharePreview, type SharePreview } from '../share/preview';
import { download } from '../persistence/storage';

import { tr , translateMessage } from '../i18n';
export function ShareDialog({ studio: s, onClose }: { studio: Studio; onClose: () => void }) {
  const project = s.project,
    previous = publishedFor(project.metadata.id),
    [preview, setPreview] = useState<SharePreview | null>(null),
    [previewReady, setPreviewReady] = useState(false),
    [sizes, setSizes] = useState<{ json: number; gzip: number } | null>(null),
    [currentHash, setCurrentHash] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [result, setResult] = useState<{ id: string; link: string; preview: boolean } | null>(
      previous && previous.link ? null : null,
    ),
    [showPrevious, setShowPrevious] = useState(false),
    [copied, setCopied] = useState(false);

  const unchanged = !!previous && !!currentHash && previous.hash === currentHash,
    title = project.metadata.name || 'Creación',
    description = project.metadata.example?.description ?? '';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const document = shareDocument(project);
        if (cancelled) return;
        setSizes({ json: byteLength(document), gzip: await gzipSize(document) });
        setCurrentHash(await documentHash(document));
        try {
          const data = await renderSharePreview(project);
          if (!cancelled) setPreview(data);
        } finally {
          if (!cancelled) setPreviewReady(true);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.metadata.id]);

  const text = encodeURIComponent(`${title} · creación en Pattern Studio`),
    link = result?.link ?? (showPrevious ? previous?.link : undefined),
    shareUrls = useMemo(
      () =>
        link
          ? {
              whatsapp: `https://wa.me/?text=${text}%20${encodeURIComponent(link)}`,
              telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`,
              facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
              x: `https://x.com/intent/tweet?text=${text}&url=${encodeURIComponent(link)}`,
            }
          : null,
      [link, text],
    );

  const publish = async () => {
    setBusy('Publicando…');
    setError('');
    try {
      const published = await publishShare(project, preview?.dataUrl, title, description);
      setResult(published);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('No se pudo copiar; seleccioná el enlace manualmente.');
    }
  };

  const remove = async () => {
    const id = result?.id ?? previous?.id;
    if (!id || !secretFor(id)) return;
    if (!window.confirm(tr('¿Retirar esta publicación? El enlace dejará de funcionar.'))) return;
    setBusy('Retirando…');
    try {
      await deleteShare(id);
      forgetPublished(project.metadata.id);
      setResult(null);
      setShowPrevious(false);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal label={tr('Compartir creación')} className="share-dialog" onClose={onClose}>
      <header>
        <div>
          <small>{tr('PUBLICACIÓN VOLUNTARIA · ENLACE PERMANENTE')}</small>
          <h2>{tr('Compartir')}</h2>
        </div>
        <button aria-label={tr('Cerrar compartir')} onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="share-body">
        <div className="share-preview">
          {preview ? (
            <img
              src={preview.dataUrl}
              alt={tr('Miniatura de la creación')}
              width={preview.width}
              height={preview.height}
            />
          ) : previewReady ? (
            <p role="status">
              {tr('Esta creación no cabe en una miniatura de 100 KiB: se publicará con la tarjeta genérica de Patterns. El enlace y la creación siguen siendo válidos.')}
            </p>
          ) : (
            <p role="status">{tr('Preparando la miniatura…')}</p>
          )}
        </div>
        <div className="share-info">
          <h3>{title}</h3>
          <p>
            {tr('La publicación será pública: cualquiera con el enlace podrá ver y editar una copia. Tu estudio local no se modifica y sigue funcionando sin conexión.')}
          </p>
          {sizes && (
            <p className="help-text">
              {tr('Documento')} ~{(sizes.json / 1024).toFixed(1)} KiB · {tr('comprimido')} ~
              {(sizes.gzip / 1024).toFixed(1)} KiB
            </p>
          )}
          {previous && !result && (
            <div className="share-previous">
              {unchanged ? (
                <>
                  <p>{tr('Este estudio ya está publicado con el mismo contenido.')}</p>
                  <button onClick={() => setShowPrevious(true)}>
                    <Link2 size={15} /> {tr('Usar el enlace existente')}
                  </button>
                </>
              ) : (
                <>
                  <p>
                    {tr('Existen cambios posteriores a la publicación anterior. Podés compartir la versión ya publicada o crear una publicación nueva.')}
                  </p>
                  <button onClick={() => setShowPrevious(true)}>{tr('Compartir la versión anterior')}</button>
                </>
              )}
            </div>
          )}
          {!result && !link && (
            <button
              className="primary"
              disabled={!!busy || !previewReady}
              onClick={() => void publish()}
            >
              <Share2 size={16} /> {busy || tr('Crear enlace público')}
            </button>
          )}
          {link && (
            <>
              <label className="share-link">
                {tr('Enlace público')}
                <span>
                  <input readOnly value={link} aria-label={tr('Enlace público')} onFocus={(e) => e.target.select()} />
                  <button aria-label={tr('Copiar enlace')} onClick={() => void copy()}>
                    <Copy size={15} /> {copied ? tr('Copiado') : tr('Copiar')}
                  </button>
                </span>
              </label>
              {shareUrls && (
                <div className="share-networks" role="group" aria-label={tr('Compartir en redes')}>
                  <a href={shareUrls.whatsapp} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                  <a href={shareUrls.telegram} target="_blank" rel="noreferrer">
                    Telegram
                  </a>
                  <a href={shareUrls.facebook} target="_blank" rel="noreferrer">
                    Facebook
                  </a>
                  <a href={shareUrls.x} target="_blank" rel="noreferrer">
                    X
                  </a>
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      onClick={() =>
                        void navigator.share({ title, text: `${title} · Pattern Studio`, url: link })
                      }
                    >
                      {tr('Compartir…')}
                    </button>
                  )}
                </div>
              )}
              <details className="share-instagram">
                <summary>{tr('Instagram')}</summary>
                <p>
                  {tr('Instagram no ofrece publicar un enlace con vista previa desde la web. Copiá el enlace o descargá la miniatura y agregá el enlace en tu publicación o historia.')}
                </p>
                <button onClick={() => void copy()}>
                  <Copy size={14} /> {tr('Copiar enlace')}
                </button>
                {preview && (
                  <button
                    onClick={() =>
                      download(
                        dataUrlToBlob(preview.dataUrl),
                        `${title.slice(0, 40)}.jpg`,
                        'image/jpeg',
                      )
                    }
                  >
                    <Download size={14} /> {tr('Descargar miniatura')}
                  </button>
                )}
              </details>
              {secretFor(result?.id ?? previous?.id ?? '') && (
                <button className="share-remove" onClick={() => void remove()}>
                  <Trash2 size={14} /> {tr('Retirar publicación de este dispositivo')}
                </button>
              )}
            </>
          )}
          {error && (
            <p className="disk-error" role="alert">
              {translateMessage(error)}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, data] = dataUrl.split(','),
    binary = atob(data),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: head.slice(5, head.indexOf(';')) || 'image/jpeg' });
}

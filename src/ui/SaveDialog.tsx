import { useState } from 'react';
import { Modal } from './Modal';
import { studyFileName } from '../app/naming';

import { tr } from '../i18n';
export function SaveDialog({
  name,
  busy = false,
  onSave,
  onClose,
}: {
  name: string;
  busy?: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => studyFileName(name));
  return (
    <Modal label={tr('Guardar proyecto')} className="save-dialog" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
        }}
      >
        <h2>{tr('Guardar proyecto')}</h2>
        <label className="text-field">
          <span>{tr('Nombre del archivo')}</span>
          <input
            autoFocus
            aria-label={tr('Nombre del archivo')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <p className="hint">
          {tr('Se guardará un archivo editable .pattern.json. El trabajo también se conserva automáticamente en este navegador.')}
        </p>
        <div className="save-actions">
          <button type="button" onClick={onClose}>
            {tr('Cancelar')}
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? tr('Guardando…') : tr('Guardar archivo')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

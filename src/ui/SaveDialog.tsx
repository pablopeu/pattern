import { useState } from 'react';
import { Modal } from './Modal';
import { studyFileName } from '../app/naming';

export function SaveDialog({
  name,
  onSave,
  onClose,
}: {
  name: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => studyFileName(name));
  return (
    <Modal label="Guardar proyecto" className="save-dialog" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
        }}
      >
        <h2>Guardar proyecto</h2>
        <label className="text-field">
          <span>Nombre del archivo</span>
          <input
            autoFocus
            aria-label="Nombre del archivo"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <p className="hint">
          Se guardará un archivo editable .pattern.json. El trabajo también se conserva
          automáticamente en este navegador.
        </p>
        <div className="save-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary">
            Guardar archivo
          </button>
        </div>
      </form>
    </Modal>
  );
}

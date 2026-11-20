import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from './Modal';

export type Command = { id: string; label: string; keywords?: string; run: () => void };
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState(''),
    [active, setActive] = useState(0);
  const filtered = commands.filter((c) =>
    normalize(`${c.label} ${c.keywords ?? ''}`).includes(normalize(query)),
  );
  const visible = filtered.slice(0, 8);
  const execute = (command: Command) => {
    onClose();
    command.run();
  };
  return (
    <Modal label="Buscar comandos" className="command-modal" onClose={onClose}>
      <header>
        <h2>Buscar herramientas y acciones</h2>
        <button aria-label="Cerrar comandos" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <input
        autoFocus
        role="combobox"
        aria-label="Buscar acción"
        aria-autocomplete="list"
        aria-controls="command-results"
        aria-expanded="true"
        aria-activedescendant={visible[active] ? `command-${visible[active].id}` : undefined}
        placeholder="Polígono, rellenar, p6m, grosor, exportar…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            setActive(
              (old) =>
                (old + (e.key === 'ArrowDown' ? 1 : -1) + visible.length) % (visible.length || 1),
            );
          }
          if (e.key === 'Enter' && visible[active]) {
            e.preventDefault();
            execute(visible[active]);
          }
        }}
      />
      <div id="command-results" role="listbox" aria-label="Resultados de comandos">
        {visible.map((command, i) => (
          <button
            key={command.id}
            id={`command-${command.id}`}
            role="option"
            aria-selected={active === i}
            onClick={() => execute(command)}
          >
            {command.label}
          </button>
        ))}
      </div>
      {!visible.length && <p role="status">No hay coincidencias.</p>}
      <p className="help-text">
        Escribí para filtrar · ↑ ↓ para elegir · Enter para ejecutar · Escape para volver.
      </p>
    </Modal>
  );
}

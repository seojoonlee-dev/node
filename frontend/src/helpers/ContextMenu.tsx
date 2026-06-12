import { useEffect } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

export function ContextMenu({ x, y, path, onClose, onRename, onDelete }: ContextMenuProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('click', onClose);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', onClose);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="context-menu" style={{ top: y, left: x }}>
      <button
        className="context-menu-item"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(path);
          onClose();
        }}
      >
        Copy File Path
      </button>
      <button
        className="context-menu-item"
        onClick={(e) => {
          e.stopPropagation();
          onRename(path);
          onClose();
        }}
      >
        Rename File
      </button>
      <button
        className="context-menu-item is-danger"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(path);
          onClose();
        }}
      >
        Delete File
      </button>
    </div>
  );
}

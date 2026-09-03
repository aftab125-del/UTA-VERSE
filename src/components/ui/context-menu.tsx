"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ContextMenuAction {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  actions: ContextMenuAction[];
  children: React.ReactNode;
}

export function ContextMenu({ actions, children }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - actions.length * 36 - 16);
    setPos({ x, y });
    setOpen(true);
  }, [actions.length]);

  useEffect(() => {
    if (!open) return;
    function close() { setOpen(false); }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("click", close);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      <div onContextMenu={handleContextMenu} style={{ display: "contents" }}>
        {children}
      </div>
      {open && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ left: pos.x, top: pos.y }}
          role="menu"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`context-menu__item${action.danger ? " context-menu__item--danger" : ""}`}
              role="menuitem"
              onClick={() => { action.onClick(); setOpen(false); }}
            >
              {action.icon && <span className="context-menu__icon" aria-hidden="true">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

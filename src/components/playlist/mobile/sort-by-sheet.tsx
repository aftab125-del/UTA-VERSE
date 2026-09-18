"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export type SortOption = "custom" | "title" | "artist" | "album" | "recent";

interface SortBySheetProps {
  open: boolean;
  onClose: () => void;
  selectedSort: SortOption;
  onSelectSort: (sort: SortOption) => void;
}

const SORT_ITEMS: Array<{ id: SortOption; label: string }> = [
  { id: "custom", label: "Custom order" },
  { id: "title", label: "Title" },
  { id: "artist", label: "Artist" },
  { id: "album", label: "Album" },
  { id: "recent", label: "Recently added" },
];

export function SortBySheet({ open, onClose, selectedSort, onSelectSort }: SortBySheetProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="mobile-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Sort by">
      <div className="mobile-sheet-card" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sheet-drag-handle" aria-hidden="true" />
        
        <h3 className="mobile-sheet-title">Sort by</h3>

        <div className="mobile-sheet-options">
          {SORT_ITEMS.map((item) => {
            const isSelected = selectedSort === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`mobile-sheet-option-btn${isSelected ? " mobile-sheet-option-btn--active" : ""}`}
                onClick={() => {
                  onSelectSort(item.id);
                  onClose();
                }}
              >
                <span>{item.label}</span>
                {isSelected && (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mobile-sheet-checkmark"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

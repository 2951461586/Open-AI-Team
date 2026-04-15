'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  action?: () => void;
}

interface ContextMenuProviderProps {
  children: React.ReactNode;
}

export function ContextMenuProvider({ children }: ContextMenuProviderProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', closeContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', closeContextMenu);
    };
  }, [handleContextMenu, closeContextMenu]);

  return (
    <>
      {children}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
}

export function showContextMenu(x: number, y: number, items: MenuItem[]) {
  document.dispatchEvent(new CustomEvent('show-context-menu', { detail: { x, y, items } }));
}

export function useContextMenu(items: MenuItem[]) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setAnchor({ x: e.clientX, y: e.clientY });
  }, []);

  return {
    anchor,
    onContextMenu: handleContextMenu,
    close: () => setAnchor(null),
    contextMenu: anchor ? <ContextMenu x={anchor.x} y={anchor.y} items={items} onClose={() => setAnchor(null)} /> : null,
  };
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      if (x + rect.width > viewportWidth) {
        newX = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight) {
        newY = viewportHeight - rect.height - 8;
      }

      setAdjustedPos({ x: newX, y: newY });
    }
  }, [x, y]);

  const handleItemClick = (item: MenuItem) => {
    if (!item.disabled && item.action) {
      item.action();
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`divider-${index}`} className="h-px bg-gray-200 dark:bg-gray-700 my-1" />;
        }

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors',
              item.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : item.danger
                ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            {item.icon && <span className="w-4 h-4">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <kbd className="text-xs text-gray-400 font-mono">{item.shortcut}</kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ContextMenu;

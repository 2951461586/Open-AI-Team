'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutHandler {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[], enabled = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrlKey === (e.ctrlKey || e.metaKey);
      const shiftMatch = !!shortcut.shiftKey === e.shiftKey;
      const altMatch = !!shortcut.altKey === e.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        if (isInput && !shortcut.ctrlKey && !shortcut.metaKey) continue;
        
        e.preventDefault();
        shortcut.handler();
        return;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const DEFAULT_SHORTCUTS = {
  newChat: { key: 'n', ctrlKey: true, description: 'New chat' },
  toggleSidebar: { key: 's', ctrlKey: true, shiftKey: true, description: 'Toggle sidebar' },
  settings: { key: ',', ctrlKey: true, description: 'Open settings' },
  search: { key: 'k', ctrlKey: true, description: 'Search' },
  escape: { key: 'Escape', description: 'Close/Cancel' },
};

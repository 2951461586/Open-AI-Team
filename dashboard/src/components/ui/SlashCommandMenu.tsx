'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Command, Hash, Bot, FileText, Image, BarChart3, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: typeof Command;
  action: string;
  shortcut?: string;
}

const COMMANDS: Command[] = [
  { id: 'skill', label: '/skill', description: 'Attach a skill to your message', icon: Bot, action: 'skill' },
  { id: 'search', label: '/search', description: 'Search the web', icon: Search, action: 'search' },
  { id: 'report', label: '/report', description: 'Generate a report', icon: FileText, action: 'report' },
  { id: 'chart', label: '/chart', description: 'Create a chart', icon: BarChart3, action: 'chart' },
  { id: 'image', label: '/image', description: 'Generate an image', icon: Image, action: 'image' },
  { id: 'research', label: '/research', description: 'Deep research on a topic', icon: Sparkles, action: 'research' },
];

interface SlashCommandMenuProps {
  inputValue: string;
  onSelect: (command: Command, value: string) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ inputValue, onSelect, onClose }: SlashCommandMenuProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredCommands = COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex], inputValue);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, selectedIndex, onSelect, onClose, inputValue]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!inputValue.startsWith('/')) {
    return null;
  }

  const searchTerm = inputValue.slice(1).toLowerCase();
  const displayCommands = searchTerm
    ? filteredCommands
    : COMMANDS;

  if (displayCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50"
    >
      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search commands..."
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          autoFocus
        />
      </div>

      <div className="max-h-64 overflow-y-auto py-1">
        {displayCommands.map((cmd, index) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.id}
              onClick={() => onSelect(cmd, inputValue)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg',
                index === selectedIndex
                  ? 'bg-blue-100 dark:bg-blue-800'
                  : 'bg-gray-100 dark:bg-gray-700'
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100">{cmd.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{cmd.description}</div>
              </div>
              {cmd.shortcut && (
                <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-600 rounded text-gray-500 dark:text-gray-300">
                  {cmd.shortcut}
                </kbd>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 flex items-center gap-2">
        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd>
        <span>to navigate</span>
        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded ml-2">↵</kbd>
        <span>to select</span>
        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded ml-2">esc</kbd>
        <span>to close</span>
      </div>
    </div>
  );
}

export default SlashCommandMenu;

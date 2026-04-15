'use client';

import { useState, useCallback } from 'react';
import { LayoutDashboard, Plus, Upload, File, FileText, Image, Trash2, Download, FolderOpen, Clock, CheckCircle2, MessageSquare, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/context';

interface DeskFile {
  id: string;
  name: string;
  type: 'file' | 'note' | 'image';
  size?: number;
  createdAt: string;
  updatedAt: string;
  preview?: string;
  status?: 'draft' | 'published';
}

interface DeskNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'published';
}

interface DeskPanelProps {
  files?: DeskFile[];
  notes?: DeskNote[];
  onFileUpload?: (file: File) => void;
  onFileDelete?: (fileId: string) => void;
  onFileDownload?: (fileId: string) => void;
  onNoteCreate?: (content: string) => void;
  onNoteDelete?: (noteId: string) => void;
  className?: string;
}

const MOCK_FILES: DeskFile[] = [
  { id: '1', name: 'project-notes.md', type: 'note', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString(), status: 'published' },
  { id: '2', name: 'screenshot.png', type: 'image', size: 245000, createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: '3', name: 'requirements.txt', type: 'file', size: 1200, createdAt: new Date(Date.now() - 259200000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
];

const MOCK_NOTES: DeskNote[] = [
  { id: '1', content: 'Remember to check the API documentation for the new endpoints', createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 1800000).toISOString(), status: 'draft' },
  { id: '2', content: 'User prefers concise responses with actionable items', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 43200000).toISOString(), status: 'published' },
];

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(type: DeskFile['type']) {
  switch (type) {
    case 'note': return FileText;
    case 'image': return Image;
    default: return File;
  }
}

export function DeskPanel({
  files = MOCK_FILES,
  notes = MOCK_NOTES,
  onFileUpload,
  onFileDelete,
  onFileDownload,
  onNoteCreate,
  onNoteDelete,
  className,
}: DeskPanelProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'files' | 'notes'>('files');
  const [showUpload, setShowUpload] = useState(false);
  const [newNote, setNewNote] = useState('');

  const handleNoteCreate = useCallback(() => {
    if (newNote.trim()) {
      onNoteCreate?.(newNote);
      setNewNote('');
    }
  }, [newNote, onNoteCreate]);

  return (
    <div className={cn('flex flex-col h-full bg-[var(--surface)]', className)}>
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--fg)]">{t('desk.title', 'Desk')}</h2>
            <p className="text-xs text-[var(--fg-muted)]">{t('desk.subtitle', 'Files and notes')}</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Upload className="h-4 w-4" />
          {t('desk.upload', 'Upload')}
        </button>
      </div>

      <div className="flex border-b border-[var(--border)] px-6">
        <button
          onClick={() => setActiveTab('files')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'files'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
          )}
        >
          <FolderOpen className="h-4 w-4" />
          {t('desk.files', 'Files')} ({files.length})
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'notes'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
          )}
        >
          <MessageSquare className="h-4 w-4" />
          {t('desk.notes', 'Notes')} ({notes.length})
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'files' ? (
            <div className="space-y-2">
            {files.map((file) => {
              const Icon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="group flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--fg)] truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(file.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onFileDownload?.(file.id)}
                      className="p-2 rounded-lg hover:bg-[var(--surface)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onFileDelete?.(file.id)}
                      className="p-2 rounded-lg hover:bg-[var(--danger-soft)] text-[var(--fg-muted)] hover:text-[var(--danger)] transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            
            {files.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-[var(--fg-muted)]">
                <FolderOpen className="h-12 w-12 mb-3 opacity-30" />
                <p>{t('desk.noFiles', 'No files yet')}</p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="mt-3 px-4 py-2 text-sm font-medium rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                >
                  {t('desk.uploadFirst', 'Upload your first file')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNoteCreate()}
                placeholder={t('desk.newNotePlaceholder', 'Write a note...')}
                className="flex-1 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all"
              />
              <button
                onClick={handleNoteCreate}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="group p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] hover:border-[var(--accent)] transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'px-2 py-0.5 text-xs rounded-full font-medium',
                        note.status === 'published' 
                          ? 'bg-[var(--success-soft)] text-[var(--success)]' 
                          : 'bg-[var(--warning-soft)] text-[var(--warning)]'
                      )}>
                        {note.status === 'published' ? (
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Published</span>
                        ) : (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Draft</span>
                        )}
                      </span>
                      <span className="text-xs text-[var(--fg-muted)]">{formatRelativeTime(note.updatedAt)}</span>
                    </div>
                    <button
                      onClick={() => onNoteDelete?.(note.id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--danger-soft)] text-[var(--fg-muted)] hover:text-[var(--danger)] transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm text-[var(--fg)]">{note.content}</p>
                </div>
              ))}
              
              {notes.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-[var(--fg-muted)]">
                  <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
                  <p>{t('desk.noNotes', '暂无笔记')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeskPanel;

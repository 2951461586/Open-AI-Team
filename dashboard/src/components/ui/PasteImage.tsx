'use client';

import { useCallback } from 'react';
import { X, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsePasteImageOptions {
  onPaste: (file: File) => void;
  enabled?: boolean;
}

export function usePasteImage({ onPaste, enabled = true }: UsePasteImageOptions) {
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onPaste(file);
          break;
        }
      }
    }
  }, [enabled, onPaste]);

  return {
    handlePaste,
    pasteListener: enabled ? { onPaste: handlePaste } : {},
  };
}

export function ImagePreview({ 
  src, 
  alt = '',
  onClick 
}: { 
  src: string; 
  alt?: string;
  onClick?: () => void;
}) {
  return (
    <div 
      className={cn('relative group cursor-pointer', onClick && 'hover:opacity-90 transition-opacity')}
      onClick={onClick}
    >
      <img 
        src={src} 
        alt={alt} 
        className="max-w-full max-h-64 rounded-lg object-contain" 
      />
      {onClick && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
          <span className="text-white text-sm">Click to expand</span>
        </div>
      )}
    </div>
  );
}

export function FilePreviewPanel({ 
  files, 
  onRemove,
  onPreview 
}: { 
  files: Array<{ id: string; name: string; type: string; url?: string }>;
  onRemove?: (id: string) => void;
  onPreview?: (id: string) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <p className="text-xs text-gray-500 font-medium">Attachments ({files.length})</p>
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="relative group flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
          >
            {file.url ? (
              <img 
                src={file.url} 
                alt={file.name}
                className="w-8 h-8 object-cover rounded"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                <span className="text-xs text-gray-500">{file.type.split('/')[1]?.slice(0, 3)}</span>
              </div>
            )}
            <span className="text-sm text-gray-700 dark:text-gray-300 max-w-24 truncate">
              {file.name}
            </span>
            <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {onPreview && (
                <button
                  onClick={() => onPreview(file.id)}
                  className="p-0.5 bg-blue-500 text-white rounded-full"
                >
                  <Eye className="w-3 h-3" />
                </button>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(file.id)}
                  className="p-0.5 bg-red-500 text-white rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

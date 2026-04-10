'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, File, Image, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileItem {
  id: string;
  file: File;
  preview?: string;
}

interface FileUploaderProps {
  onFiles: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  children?: React.ReactNode;
}

export function useFileUploader({ onFiles, maxFiles = 5, maxSize = 10 * 1024 * 1024, accept }: FileUploaderProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).slice(0, maxFiles);
    const validFiles = fileArray.filter(f => f.size <= maxSize);

    const fileItems: FileItem[] = validFiles.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setFiles(prev => [...prev, ...fileItems].slice(0, maxFiles));
    onFiles(validFiles);
  }, [maxFiles, maxSize, onFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const item = prev.find(f => f.id === id);
      if (item?.preview) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    files.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
  }, [files]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
    }
    e.target.value = '';
  }, [processFiles]);

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    files,
    isDragging,
    inputRef,
    processFiles,
    removeFile,
    clearFiles,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInputChange,
    openFileDialog,
  };
}

export function FileUploader({ 
  children,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onInputChange,
  onClick,
  inputRef,
  accept 
}: FileUploaderProps & {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClick: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer',
        isDragging
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={onInputChange}
        className="hidden"
      />
      {children || (
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className="w-8 h-8 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drag files here or click to upload
          </p>
        </div>
      )}
    </div>
  );
}

export function FilePreview({ files, onRemove }: { files: FileItem[]; onRemove: (id: string) => void }) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((item) => {
        const Icon = item.preview ? Image : File;
        return (
          <div
            key={item.id}
            className="group relative flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
          >
            {item.preview ? (
              <img src={item.preview} alt="" className="w-8 h-8 object-cover rounded" />
            ) : (
              <Icon className="w-5 h-5 text-gray-500" />
            )}
            <span className="text-sm text-gray-700 dark:text-gray-300 max-w-24 truncate">
              {item.file.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.id);
              }}
              className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

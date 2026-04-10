'use client';

import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  text?: string;
  className?: string;
}

export function TypingIndicator({ text = 'AI is thinking...', className }: TypingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400', className)}>
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      {text && <span>{text}</span>}
    </div>
  );
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex gap-1', className)}>
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
    </div>
  );
}

export default TypingIndicator;

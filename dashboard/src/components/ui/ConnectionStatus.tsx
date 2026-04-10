'use client';

import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  showLabel?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  connected: {
    icon: Wifi,
    label: 'Connected',
    color: 'bg-green-500',
    textColor: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  connecting: {
    icon: Loader2,
    label: 'Connecting...',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
  },
  disconnected: {
    icon: WifiOff,
    label: 'Disconnected',
    color: 'bg-gray-400',
    textColor: 'text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
  },
  error: {
    icon: WifiOff,
    label: 'Connection Error',
    color: 'bg-red-500',
    textColor: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
};

export function ConnectionStatusIndicator({ 
  status, 
  showLabel = false,
  className 
}: ConnectionStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isAnimating = status === 'connecting';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <div className={cn('w-2 h-2 rounded-full', config.color)} />
        {isAnimating && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
        )}
      </div>
      {showLabel && (
        <span className={cn('text-sm', config.textColor)}>{config.label}</span>
      )}
    </div>
  );
}

export function ConnectionStatusBar({ 
  status, 
  onRetry 
}: { 
  status: ConnectionStatus;
  onRetry?: () => void;
}) {
  if (status === 'connected') return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isAnimating = status === 'connecting';

  return (
    <div className={cn('flex items-center justify-between px-4 py-2', config.bgColor)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', config.textColor, isAnimating && 'animate-spin')} />
        <span className={cn('text-sm font-medium', config.textColor)}>
          {config.label}
        </span>
      </div>
      {onRetry && status !== 'connecting' && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default ConnectionStatusIndicator;

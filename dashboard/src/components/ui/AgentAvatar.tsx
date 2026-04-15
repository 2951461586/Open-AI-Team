'use client';

import { cn } from '@/lib/utils';
import { Bot, Circle } from 'lucide-react';

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'error' | 'offline';

interface AgentAvatarProps {
  name?: string;
  status?: AgentStatus;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'bg-[var(--success)]',
  thinking: 'bg-[var(--warning)]',
  working: 'bg-[var(--accent)]',
  error: 'bg-[var(--danger)]',
  offline: 'bg-[var(--fg-muted)]',
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  working: 'Working',
  error: 'Error',
  offline: 'Offline',
};

const SIZE_CLASSES = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-14 w-14 text-lg',
};

const STATUS_SIZE_CLASSES = {
  sm: 'h-2 w-2 border',
  md: 'h-2.5 w-2.5 border',
  lg: 'h-3 w-3 border-2',
  xl: 'h-4 w-4 border-2',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AgentAvatar({
  name = 'AI',
  status = 'idle',
  size = 'md',
  showStatus = true,
  className,
}: AgentAvatarProps) {
  return (
    <div className={cn('relative inline-flex', className)}>
      <div 
        className={cn(
          'flex items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-soft)] text-white font-medium',
          SIZE_CLASSES[size]
        )}
      >
        {name === 'AI' ? (
          <Bot className={SIZE_CLASSES[size]} />
        ) : (
          getInitials(name)
        )}
      </div>
      
      {showStatus && (
        <span 
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white dark:border-[var(--surface)]',
            STATUS_COLORS[status],
            STATUS_SIZE_CLASSES[size]
          )}
          title={STATUS_LABELS[status]}
        />
      )}
    </div>
  );
}

interface AgentStatusBadgeProps {
  status: AgentStatus;
  label?: string;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

export function AgentStatusBadge({
  status,
  label,
  showDot = true,
  size = 'md',
}: AgentStatusBadgeProps) {
  return (
    <div 
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        status === 'idle' && 'bg-[var(--success-soft)] text-[var(--success)]',
        status === 'thinking' && 'bg-[var(--warning-soft)] text-[var(--warning)]',
        status === 'working' && 'bg-[var(--accent-soft)] text-[var(--accent)]',
        status === 'error' && 'bg-[var(--danger-soft)] text-[var(--danger)]',
        status === 'offline' && 'bg-[var(--surface-muted)] text-[var(--fg-muted)]',
      )}
    >
      {showDot && (
        <Circle 
          className={cn(
            'fill-current',
            STATUS_COLORS[status],
            size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
          )} 
        />
      )}
      <span className="font-medium">
        {label || STATUS_LABELS[status]}
      </span>
    </div>
  );
}

interface AgentCardProps {
  name: string;
  role?: string;
  status?: AgentStatus;
  personality?: string;
  onClick?: () => void;
  className?: string;
}

export function AgentCard({
  name,
  role,
  status = 'idle',
  personality,
  onClick,
  className,
}: AgentCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-md transition-all text-left w-full',
        className
      )}
    >
      <AgentAvatar name={name} status={status} size="lg" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-[var(--fg)] truncate">{name}</span>
          <AgentStatusBadge status={status} size="sm" />
        </div>
        {role && (
          <p className="text-xs text-[var(--fg-muted)] truncate">{role}</p>
        )}
        {personality && (
          <p className="text-xs text-[var(--accent)] truncate mt-0.5">{personality}</p>
        )}
      </div>
    </button>
  );
}

interface TeamRosterProps {
  agents: Array<{
    id: string;
    name: string;
    role?: string;
    status: AgentStatus;
    personality?: string;
  }>;
  activeAgentId?: string;
  onAgentClick?: (agentId: string) => void;
  className?: string;
}

export function TeamRoster({
  agents,
  activeAgentId,
  onAgentClick,
  className,
}: TeamRosterProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          name={agent.name}
          role={agent.role}
          status={agent.status}
          personality={agent.personality}
          onClick={() => onAgentClick?.(agent.id)}
          className={cn(
            activeAgentId === agent.id && 'border-[var(--accent)] bg-[var(--accent-soft)]/30'
          )}
        />
      ))}
    </div>
  );
}

export default AgentAvatar;

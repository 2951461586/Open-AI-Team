'use client';

import { useState, useEffect, useCallback } from 'react';
import { MemoryStick, RefreshCw, Trash2, Filter, Clock, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/context';

interface MemoryEntry {
  key: string;
  decayValue: number;
  importance: number;
  accessCount: number;
  createdAt: string;
  lastAccessedAt: string;
}

interface MemoryDecayStats {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

interface MemoryDecayPanelProps {
  apiEndpoint?: string;
  refreshInterval?: number;
  maxEntries?: number;
  onEntryClick?: (entry: MemoryEntry) => void;
}

function getDecayColor(value: number): string {
  if (value >= 0.7) return 'bg-[var(--success)]';
  if (value >= 0.4) return 'bg-[var(--warning)]';
  if (value >= 0.2) return 'bg-[var(--warning)]';
  return 'bg-[var(--danger)]';
}

function getDecayLabel(value: number): string {
  if (value >= 0.7) return 'High';
  if (value >= 0.4) return 'Medium';
  if (value >= 0.2) return 'Low';
  return 'Critical';
}

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

const MOCK_ENTRIES: MemoryEntry[] = [
  { key: 'task:planner:2024-001', decayValue: 0.85, importance: 0.9, accessCount: 24, createdAt: new Date(Date.now() - 86400000).toISOString(), lastAccessedAt: new Date(Date.now() - 300000).toISOString() },
  { key: 'context:user:preferences', decayValue: 0.72, importance: 0.8, accessCount: 156, createdAt: new Date(Date.now() - 172800000).toISOString(), lastAccessedAt: new Date(Date.now() - 60000).toISOString() },
  { key: 'artifact:report:draft-2024', decayValue: 0.65, importance: 0.7, accessCount: 8, createdAt: new Date(Date.now() - 259200000).toISOString(), lastAccessedAt: new Date(Date.now() - 7200000).toISOString() },
  { key: 'session:chat:2024-03-10', decayValue: 0.45, importance: 0.5, accessCount: 42, createdAt: new Date(Date.now() - 345600000).toISOString(), lastAccessedAt: new Date(Date.now() - 14400000).toISOString() },
  { key: 'task:executor:pending', decayValue: 0.32, importance: 0.6, accessCount: 3, createdAt: new Date(Date.now() - 432000000).toISOString(), lastAccessedAt: new Date(Date.now() - 28800000).toISOString() },
];

const MOCK_STATS: MemoryDecayStats = {
  size: 2847,
  hits: 15234,
  misses: 892,
  evictions: 156,
  hitRate: 0.945,
};

export function MemoryDecayPanel({
  apiEndpoint = '/api/memory/decay',
  refreshInterval = 5000,
  maxEntries = 50,
  onEntryClick,
}: MemoryDecayPanelProps) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<MemoryEntry[]>(MOCK_ENTRIES);
  const [stats, setStats] = useState<MemoryDecayStats | null>(MOCK_STATS);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'decay' | 'importance' | 'recency'>('decay');
  const [filterMinValue, setFilterMinValue] = useState(0);

  const fetchMemoryData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}?sort=${sortBy}&limit=${maxEntries}&minValue=${filterMinValue}`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      setEntries(data.entries || MOCK_ENTRIES);
      setStats(data.stats || MOCK_STATS);
    } catch {
      setEntries(MOCK_ENTRIES);
      setStats(MOCK_STATS);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, sortBy, maxEntries, filterMinValue]);

  useEffect(() => {
    fetchMemoryData();
  }, [fetchMemoryData]);

  const handlePrune = async (threshold: number) => {
    setEntries(prev => prev.filter(e => e.decayValue >= threshold));
  };

  const sortedEntries = [...entries].sort((a, b) => {
    if (sortBy === 'decay') return b.decayValue - a.decayValue;
    if (sortBy === 'importance') return b.importance - a.importance;
    return new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime();
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <MemoryStick className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--fg)]">{t('memory.title', 'Memory Monitor')}</h2>
            <p className="text-xs text-[var(--fg-muted)]">{t('memory.decay', 'Memory Decay')}</p>
          </div>
        </div>
        <button
          onClick={fetchMemoryData}
          className="p-2 rounded-lg hover:bg-[var(--surface-subtle)] transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4 text-[var(--fg-muted)]', loading && 'animate-spin')} />
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
            <div className="text-xs text-[var(--fg-muted)] mb-1">{t('memory.entries', 'Entries')}</div>
            <div className="text-lg font-semibold text-[var(--fg)]">{stats.size.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
            <div className="text-xs text-[var(--fg-muted)] mb-1">{t('memory.hitRate', 'Hit Rate')}</div>
            <div className="text-lg font-semibold text-[var(--fg)]">{(stats.hitRate * 100).toFixed(1)}%</div>
          </div>
          <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
            <div className="text-xs text-[var(--fg-muted)] mb-1">{t('memory.evictions', 'Evictions')}</div>
            <div className="text-lg font-semibold text-[var(--fg)]">{stats.evictions}</div>
          </div>
          <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
            <div className="text-xs text-[var(--fg-muted)] mb-1">Hit/Miss</div>
            <div className="text-lg font-semibold text-[var(--fg)]">{stats.hits}/{stats.misses}</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm text-[var(--fg-secondary)]">
          <span>{t('memory.filter', 'Filter min decay')}:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={filterMinValue}
            onChange={(e) => setFilterMinValue(parseFloat(e.target.value))}
            className="w-20 accent-[var(--accent)]"
          />
          <span className="font-mono text-xs text-[var(--fg-muted)]">{filterMinValue.toFixed(2)}</span>
        </label>
        <div className="flex gap-1 ml-auto">
          {[
            { key: 'decay' as const, label: 'Decay' },
            { key: 'importance' as const, label: 'Importance' },
            { key: 'recency' as const, label: 'Recent' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={cn(
                'px-3 py-1 text-xs rounded-lg font-medium transition-colors',
                sortBy === key
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--surface-muted)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => handlePrune(filterMinValue)}
          className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[var(--fg-secondary)] transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          {t('memory.prune', 'Prune')}
        </button>
      </div>

      <div className="space-y-2">
        {sortedEntries.map((entry) => (
          <div
            key={entry.key}
            onClick={() => onEntryClick?.(entry)}
            className="group p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded-full font-medium',
                    getDecayColor(entry.decayValue).replace('bg-', 'bg-opacity-20 text-').replace('[var(--success)]', 'var(--success)').replace('[var(--warning)]', 'var(--warning)').replace('[var(--danger)]', 'var(--danger)'
                  )}>
                    {getDecayLabel(entry.decayValue)}
                  </span>
                  <span className="text-xs text-[var(--fg-muted)]">|</span>
                  <span className="text-sm font-mono text-[var(--fg)] truncate">
                    {entry.key}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)]">
                  <span>{t('memory.accessCount', 'Access')}: {entry.accessCount}</span>
                  <span>{t('memory.lastAccessed', 'Last accessed')}: {formatRelativeTime(entry.lastAccessedAt)}</span>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="px-2 py-1 text-xs font-mono bg-[var(--surface-subtle)] rounded">
                  {entry.decayValue.toFixed(3)}
                </span>
              </div>
            </div>
            
            <div className="h-2 bg-[var(--surface-subtle)] rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', getDecayColor(entry.decayValue))}
                style={{ width: `${entry.decayValue * 100}%` }}
              />
            </div>
          </div>
        ))}

        {sortedEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--fg-muted)]">
            <MemoryStick className="h-12 w-12 mb-3 opacity-30" />
            <p>{t('memory.noEntries', 'No memory entries match the current filter.')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoryDecayPanel;

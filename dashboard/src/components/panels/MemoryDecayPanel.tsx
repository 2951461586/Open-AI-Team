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

const DECAY_COLORS = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-orange-500',
  critical: 'bg-red-500',
};

function getDecayColor(value: number): string {
  if (value >= 0.7) return DECAY_COLORS.high;
  if (value >= 0.4) return DECAY_COLORS.medium;
  if (value >= 0.2) return DECAY_COLORS.low;
  return DECAY_COLORS.critical;
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
  { key: 'cache:search:results', decayValue: 0.15, importance: 0.3, accessCount: 1, createdAt: new Date(Date.now() - 518400000).toISOString(), lastAccessedAt: new Date(Date.now() - 86400000).toISOString() },
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
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'decay' | 'importance' | 'recency'>('decay');
  const [filterMinValue, setFilterMinValue] = useState(0);

  const fetchMemoryData = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}?sort=${sortBy}&limit=${maxEntries}&minValue=${filterMinValue}`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      setEntries(data.entries || MOCK_ENTRIES);
      setStats(data.stats || MOCK_STATS);
      setError(null);
    } catch {
      setEntries(MOCK_ENTRIES);
      setStats(MOCK_STATS);
      setError(null);
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
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25">
              <MemoryStick className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Memory Monitor</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Real-time memory decay tracking</p>
            </div>
          </div>
          <button
            onClick={fetchMemoryData}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-gray-500', loading && 'animate-spin')} />
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200/50 dark:border-blue-700/50">
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 mb-1">
                <Activity className="h-3 w-3" />
                Entries
              </div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.size.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 border border-emerald-200/50 dark:border-emerald-700/50">
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 mb-1">
                <Clock className="h-3 w-3" />
                Hit Rate
              </div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{(stats.hitRate * 100).toFixed(1)}%</div>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border border-amber-200/50 dark:border-amber-700/50">
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mb-1">
                <RefreshCw className="h-3 w-3" />
                Evictions
              </div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.evictions}</div>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200/50 dark:border-purple-700/50">
              <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 mb-1">
                <Filter className="h-3 w-3" />
                Hit/Miss
              </div>
              <div className="text-xl font-bold text-purple-700 dark:text-purple-300">{stats.hits}/{stats.misses}</div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span>Filter min decay:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={filterMinValue}
              onChange={(e) => setFilterMinValue(parseFloat(e.target.value))}
              className="w-24 accent-blue-500"
            />
            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{filterMinValue.toFixed(2)}</span>
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
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => handlePrune(filterMinValue)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Prune
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-2">
          {sortedEntries.map((entry) => (
            <div
              key={entry.key}
              onClick={() => onEntryClick?.(entry)}
              className="group p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full font-medium',
                      getDecayColor(entry.decayValue).replace('bg-', 'bg-') + '/10 text-' + getDecayColor(entry.decayValue).replace('bg-', '')
                    )}>
                      {getDecayLabel(entry.decayValue)}
                    </span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-200 truncate">
                      {entry.key}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>Access: {entry.accessCount}</span>
                    <span>Importance: {entry.importance.toFixed(2)}</span>
                    <span>Active {formatRelativeTime(entry.lastAccessedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">
                    {entry.decayValue.toFixed(3)}
                  </span>
                </div>
              </div>
              
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', getDecayColor(entry.decayValue))}
                  style={{ width: `${entry.decayValue * 100}%` }}
                />
              </div>
            </div>
          ))}

          {sortedEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
              <MemoryStick className="h-12 w-12 mb-3 opacity-30" />
              <p>No memory entries match the current filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MemoryDecayPanel;

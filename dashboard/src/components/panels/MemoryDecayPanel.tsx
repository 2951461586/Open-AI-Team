'use client';

import { useState, useEffect, useCallback } from 'react';

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
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-orange-500',
  critical: 'bg-red-500',
};

function getDecayColor(value: number): string {
  if (value >= 0.7) return DECAY_COLORS.high;
  if (value >= 0.4) return DECAY_COLORS.medium;
  if (value >= 0.2) return DECAY_COLORS.low;
  return DECAY_COLORS.critical;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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

export function MemoryDecayPanel({
  apiEndpoint = '/api/memory/decay',
  refreshInterval = 5000,
  maxEntries = 50,
  onEntryClick,
}: MemoryDecayPanelProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [stats, setStats] = useState<MemoryDecayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'decay' | 'importance' | 'recency'>('decay');
  const [filterMinValue, setFilterMinValue] = useState(0);

  const fetchMemoryData = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}?sort=${sortBy}&limit=${maxEntries}&minValue=${filterMinValue}`);
      if (!response.ok) throw new Error('Failed to fetch memory data');
      const data = await response.json();
      setEntries(data.entries || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, sortBy, maxEntries, filterMinValue]);

  useEffect(() => {
    fetchMemoryData();
    const interval = setInterval(fetchMemoryData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMemoryData, refreshInterval]);

  const handlePrune = async (threshold: number) => {
    try {
      const response = await fetch(`${apiEndpoint}/prune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold }),
      });
      if (!response.ok) throw new Error('Prune failed');
      fetchMemoryData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prune failed');
    }
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error && entries.length === 0) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchMemoryData}
          className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            Memory Decay Monitor
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="decay">Sort by Decay</option>
              <option value="importance">Sort by Importance</option>
              <option value="recency">Sort by Recency</option>
            </select>
            <button
              onClick={fetchMemoryData}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded">
              <p className="text-xs text-gray-500">Total Entries</p>
              <p className="text-xl font-bold text-blue-600">{stats.size}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded">
              <p className="text-xs text-gray-500">Hit Rate</p>
              <p className="text-xl font-bold text-green-600">{(stats.hitRate * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded">
              <p className="text-xs text-gray-500">Evictions</p>
              <p className="text-xl font-bold text-yellow-600">{stats.evictions}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 p-3 rounded">
              <p className="text-xs text-gray-500">Hit/Miss</p>
              <p className="text-xl font-bold text-purple-600">{stats.hits}/{stats.misses}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">Filter min decay:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={filterMinValue}
            onChange={(e) => setFilterMinValue(parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-sm font-mono">{filterMinValue.toFixed(2)}</span>
          <button
            onClick={() => handlePrune(filterMinValue)}
            className="ml-auto px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
          >
            Prune Below
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.key}
              onClick={() => onEntryClick?.(entry)}
              className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-gray-800 dark:text-white truncate">
                    {entry.key}
                  </p>
                  <p className="text-xs text-gray-500">
                    Created {formatRelativeTime(entry.createdAt)} · Last accessed {formatRelativeTime(entry.lastAccessedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-xs text-gray-500">Access: {entry.accessCount}</span>
                  <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">
                    {entry.importance.toFixed(2)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getDecayColor(entry.decayValue)} transition-all`}
                    style={{ width: `${entry.decayValue * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-12 text-right">
                  {entry.decayValue.toFixed(3)}
                </span>
              </div>
            </div>
          ))}

          {entries.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No memory entries match the current filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MemoryDecayChart({ entries }: { entries: MemoryEntry[] }) {
  const [hoveredEntry, setHoveredEntry] = useState<MemoryEntry | null>(null);

  const decayValues = entries.map((e) => e.decayValue);
  const maxValue = Math.max(...decayValues, 1);

  return (
    <div className="relative h-64 bg-white dark:bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-600 mb-4">Decay Distribution</h3>
      
      <div className="flex items-end justify-between h-48 gap-1">
        {entries.slice(0, 20).map((entry, i) => (
          <div
            key={entry.key}
            className="flex-1 flex flex-col items-center"
            onMouseEnter={() => setHoveredEntry(entry)}
            onMouseLeave={() => setHoveredEntry(null)}
          >
            <div
              className={`w-full ${getDecayColor(entry.decayValue)} rounded-t transition-all hover:opacity-80`}
              style={{ height: `${(entry.decayValue / maxValue) * 100}%` }}
            />
          </div>
        ))}
      </div>

      {hoveredEntry && (
        <div className="absolute top-2 right-2 bg-white dark:bg-gray-700 p-2 rounded shadow-lg border">
          <p className="font-mono text-xs">{hoveredEntry.key}</p>
          <p className="text-sm">Decay: {hoveredEntry.decayValue.toFixed(3)}</p>
        </div>
      )}
    </div>
  );
}

export default MemoryDecayPanel;

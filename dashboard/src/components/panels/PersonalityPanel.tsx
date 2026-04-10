'use client';

import { useState, useCallback } from 'react';
import { Bot, Save, Plus, Trash2, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/context';

interface Personality {
  id: string;
  name: string;
  tone: string;
  style: string;
  traits: string[];
  responseLength: 'short' | 'medium' | 'long';
  emojiPreference: 'none' | 'minimal' | 'auto';
  guidance: string[];
}

interface PersonalityPanelProps {
  personalities?: Personality[];
  activePersonality?: string;
  onSave?: (personalities: Personality[]) => void;
  onSelect?: (personalityId: string) => void;
  apiEndpoint?: string;
}

const RESPONSE_LENGTH_OPTIONS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

const EMOJI_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'auto', label: 'Auto' },
];

const DEFAULT_PERSONALITIES: Personality[] = [
  {
    id: 'planner',
    name: 'Planner Persona',
    tone: '严谨、偏正式',
    style: '结构化、分层表达、先结论后展开',
    traits: ['条理清晰', '风险前置', '喜欢列出假设与边界'],
    responseLength: 'medium',
    emojiPreference: 'minimal',
    guidance: ['优先输出结构和步骤', '避免口语化跳跃', '对不确定性要显式标注'],
  },
  {
    id: 'executor',
    name: 'Executor Persona',
    tone: '务实、直接、技术导向',
    style: '以完成任务为中心，少废话，强调结果和可验证性',
    traits: ['行动优先', '直接给出步骤', '关注实现细节'],
    responseLength: 'medium',
    emojiPreference: 'none',
    guidance: ['不要空谈，优先执行', '遇到约束时说明权衡', '输出可落地的结果'],
  },
  {
    id: 'critic',
    name: 'Critic Persona',
    tone: '挑剔、细致、批判性',
    style: '逐项审视，偏审计口吻',
    traits: ['喜欢找漏洞', '证据导向', '不轻易放过模糊点'],
    responseLength: 'medium',
    emojiPreference: 'none',
    guidance: ['问题必须具体', '严重性要明确', '意见要可执行'],
  },
];

export function PersonalityPanel({
  personalities = DEFAULT_PERSONALITIES,
  activePersonality,
  onSave,
  onSelect,
  apiEndpoint = '/api/personality',
}: PersonalityPanelProps) {
  const { t } = useI18n();
  const [localPersonalities, setLocalPersonalities] = useState(personalities);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleEdit = useCallback((id: string) => {
    setEditingId(id);
    setExpandedId(id);
  }, []);

  const handleFieldChange = useCallback((
    id: string,
    field: keyof Personality,
    value: string | string[]
  ) => {
    setLocalPersonalities(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, [field]: value };
    }));
    setHasChanges(true);
  }, []);

  const handleAddPersonality = useCallback(() => {
    const newId = `personality-${Date.now()}`;
    const newPersonality: Personality = {
      id: newId,
      name: 'New Personality',
      tone: '',
      style: '',
      traits: [],
      responseLength: 'medium',
      emojiPreference: 'auto',
      guidance: [],
    };
    setLocalPersonalities(prev => [...prev, newPersonality]);
    setEditingId(newId);
    setExpandedId(newId);
    setHasChanges(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setLocalPersonalities(prev => prev.filter(p => p.id !== id));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      if (apiEndpoint) {
        await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personalities: localPersonalities }),
        });
      }
      onSave?.(localPersonalities);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save personalities:', error);
    }
  }, [apiEndpoint, localPersonalities, onSave]);

  const handleTraitChange = useCallback((id: string, value: string) => {
    const traits = value.split(',').map(t => t.trim()).filter(Boolean);
    handleFieldChange(id, 'traits', traits);
  }, [handleFieldChange]);

  const handleGuidanceChange = useCallback((id: string, value: string) => {
    const guidance = value.split(',').map(g => g.trim()).filter(Boolean);
    handleFieldChange(id, 'guidance', guidance);
  }, [handleFieldChange]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Agent Personalities</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Configure agent behavior templates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddPersonality}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all text-sm font-medium"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {localPersonalities.length} personalities configured
        {activePersonality && (
          <span className="ml-2">
            · Active: <span className="font-medium text-gray-700 dark:text-gray-200">{activePersonality}</span>
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-3">
          {localPersonalities.map((personality) => (
            <div
              key={personality.id}
              className={cn(
                'rounded-2xl border transition-all duration-200',
                expandedId === personality.id
                  ? 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800 shadow-lg shadow-blue-500/10'
                  : 'bg-white/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600'
              )}
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => toggleExpand(personality.id)}
              >
                <div className="flex items-center gap-4">
                  {expandedId === personality.id ? (
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400">
                      <ChevronDown className="h-4 w-4 rotate-270" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{personality.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {personality.tone || 'No tone set'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activePersonality === personality.id && (
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      Active
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect?.(personality.id);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    Select
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(personality.id);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(personality.id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {expandedId === personality.id && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-700/50 space-y-4">
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        Name
                      </label>
                      <input
                        type="text"
                        value={personality.name}
                        onChange={(e) => handleFieldChange(personality.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        Tone
                      </label>
                      <input
                        type="text"
                        value={personality.tone}
                        onChange={(e) => handleFieldChange(personality.id, 'tone', e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., 严谨、偏正式"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Style
                    </label>
                    <textarea
                      value={personality.style}
                      onChange={(e) => handleFieldChange(personality.id, 'style', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        Response Length
                      </label>
                      <select
                        value={personality.responseLength}
                        onChange={(e) => handleFieldChange(personality.id, 'responseLength', e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      >
                        {RESPONSE_LENGTH_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        Emoji Preference
                      </label>
                      <select
                        value={personality.emojiPreference}
                        onChange={(e) => handleFieldChange(personality.id, 'emojiPreference', e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      >
                        {EMOJI_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Traits (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={personality.traits.join(', ')}
                      onChange={(e) => handleTraitChange(personality.id, e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="e.g., 条理清晰, 风险前置"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Guidance (comma-separated)
                    </label>
                    <textarea
                      value={personality.guidance.join(', ')}
                      onChange={(e) => handleGuidanceChange(personality.id, e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                      rows={2}
                      placeholder="e.g., 优先输出结构和步骤, 避免口语化跳跃"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {localPersonalities.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              <Bot className="h-12 w-12 mb-3 opacity-30" />
              <p>No personalities configured</p>
              <button
                onClick={handleAddPersonality}
                className="mt-3 px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-700 transition-all"
              >
                Create your first personality
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PersonalityPanel;

'use client';

import { useState, useCallback } from 'react';
import { Bot, Save, Plus, Trash2, ChevronDown, Eye, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/context';
import { AgentAvatar, AgentStatusBadge, AgentStatus } from '@/components/ui/AgentAvatar';

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
}

const DEFAULT_PERSONALITIES: Personality[] = [
  {
    id: 'planner',
    name: 'Planner Persona',
    tone: '严谨、偏正式',
    style: '结构化、分层表达，先结论后展开',
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
}: PersonalityPanelProps) {
  const { t } = useI18n();
  const [localPersonalities, setLocalPersonalities] = useState(personalities);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
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
    setExpandedId(newId);
    setHasChanges(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setLocalPersonalities(prev => prev.filter(p => p.id !== id));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    onSave?.(localPersonalities);
    setHasChanges(false);
  }, [localPersonalities, onSave]);

  const handleTraitChange = useCallback((id: string, value: string) => {
    const traits = value.split(',').map(t => t.trim()).filter(Boolean);
    handleFieldChange(id, 'traits', traits);
  }, [handleFieldChange]);

  const handleGuidanceChange = useCallback((id: string, value: string) => {
    const guidance = value.split(',').map(g => g.trim()).filter(Boolean);
    handleFieldChange(id, 'guidance', guidance);
  }, [handleFieldChange]);

  return (
    <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--fg)]">{t('personality.title', 'Agent 人格')}</h2>
              <p className="text-xs text-[var(--fg-muted)]">已配置 {localPersonalities.length} 个人格</p>
            </div>
          </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddPersonality}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--fg-secondary)] hover:bg-[var(--surface-subtle)] transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('personality.add', 'Add')}
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Save className="h-4 w-4" />
              {t('personality.save', 'Save')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {localPersonalities.map((personality) => (
          <div
            key={personality.id}
            className={cn(
              'rounded-xl border transition-all duration-200',
              expandedId === personality.id
                ? 'bg-[var(--surface)] border-[var(--accent)]/30'
                : 'bg-[var(--surface-subtle)] border-transparent hover:border-[var(--border)]'
            )}
          >
            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => toggleExpand(personality.id)}
            >
              <div className="flex items-center gap-4">
                {expandedId === personality.id ? (
                  <div className="p-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="p-1.5 rounded-lg bg-[var(--surface-muted)] text-[var(--fg-muted)]">
                    <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-[var(--fg)]">{personality.name}</h3>
                  <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                    {personality.tone || 'No tone set'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activePersonality === personality.id && (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    Active
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect?.(personality.id); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--surface-muted)] text-[var(--fg-secondary)] hover:bg-[var(--surface)] transition-colors"
                >
                  {t('personality.select', 'Select')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(personality.id); }}
                  className="p-1.5 rounded-lg hover:bg-[var(--danger-soft)] text-[var(--danger)] transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {expandedId === personality.id && (
              <div className="px-4 pb-4 pt-0 border-t border-[var(--border)] space-y-4">
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1.5">
                      {t('personality.name', 'Name')}
                    </label>
                    <input
                      type="text"
                      value={personality.name}
                      onChange={(e) => handleFieldChange(personality.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1.5">
                      {t('personality.tone', 'Tone')}
                    </label>
                    <input
                      type="text"
                      value={personality.tone}
                      onChange={(e) => handleFieldChange(personality.id, 'tone', e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all"
                      placeholder="e.g., 严谨、偏正式"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--fg-muted)] mb-1.5">
                    {t('personality.traits', 'Traits')}
                  </label>
                  <input
                    type="text"
                    value={personality.traits.join(', ')}
                    onChange={(e) => handleTraitChange(personality.id, e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all"
                    placeholder="comma-separated"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {localPersonalities.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--fg-muted)]">
            <Bot className="h-12 w-12 mb-3 opacity-30" />
            <p>{t('personality.empty', 'No personalities configured')}</p>
            <button
              onClick={handleAddPersonality}
              className="mt-3 px-4 py-2 text-sm font-medium rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
            >
              {t('personality.createFirst', 'Create your first personality')}
            </button>
          </div>
        )}
      </div>

      {expandedId && (
        <div className="mt-6 border-t border-[var(--border)] pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--fg)]">{t('personality.preview', 'Live Preview')}</h3>
          </div>
          
          {(() => {
            const previewPersonality = localPersonalities.find(p => p.id === expandedId);
            if (!previewPersonality) return null;
            
            return (
              <div className="rounded-xl bg-[var(--surface-subtle)] p-4">
                <div className="flex items-start gap-4 mb-4">
                  <AgentAvatar 
                    name={previewPersonality.name} 
                    status="thinking" 
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[var(--fg)]">{previewPersonality.name}</span>
                      <AgentStatusBadge status="thinking" size="sm" />
                    </div>
                    <p className="text-xs text-[var(--fg-muted)] italic">
                      {previewPersonality.tone || 'No tone set'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {previewPersonality.traits.map((trait, i) => (
                      <span 
                        key={i}
                        className="px-2 py-0.5 text-xs rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                  
                  <div className="rounded-lg bg-[var(--surface)] p-3 border border-[var(--border)]">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-3 w-3 text-[var(--fg-muted)]" />
                      <span className="text-xs text-[var(--fg-muted)]">
                        {t('personality.sampleResponse', 'Sample Response')}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--fg)] italic">
                      "{previewPersonality.style || 'Response style not configured'}"
                    </p>
                  </div>
                  
                  {previewPersonality.guidance.length > 0 && (
                    <div className="rounded-lg bg-[var(--surface)] p-3 border border-[var(--border)]">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                        <span className="text-xs text-[var(--fg-muted)]">
                          {t('personality.guidance', 'Guidance')}
                        </span>
                      </div>
                      <ul className="text-xs text-[var(--fg-secondary)] space-y-1">
                        {previewPersonality.guidance.slice(0, 3).map((g, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-[var(--accent)]">•</span>
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default PersonalityPanel;

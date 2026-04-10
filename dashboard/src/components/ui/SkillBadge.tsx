'use client';

import { Bot, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Skill {
  id: string;
  name: string;
  icon?: string;
}

interface SkillBadgeProps {
  skill: Skill;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function SkillBadge({ skill, onRemove, size = 'md' }: SkillBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
      )}
    >
      <Bot className={cn('shrink-0', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />
      <span className="font-medium">{skill.icon || ''}{skill.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

interface SkillBadgesProps {
  skills: Skill[];
  onRemove?: (id: string) => void;
  maxVisible?: number;
}

export function SkillBadges({ skills, onRemove, maxVisible = 3 }: SkillBadgesProps) {
  const visible = skills.slice(0, maxVisible);
  const hidden = skills.slice(maxVisible);

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((skill) => (
        <SkillBadge
          key={skill.id}
          skill={skill}
          onRemove={onRemove ? () => onRemove(skill.id) : undefined}
        />
      ))}
      {hidden.length > 0 && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm">
          <Plus className="w-3 h-3" />
          <span>+{hidden.length} more</span>
        </div>
      )}
    </div>
  );
}

export function SkillSelector({ onAdd }: { onAdd: (skill: Skill) => void }) {
  const availableSkills: Skill[] = [
    { id: 'web-search', name: 'Web Search', icon: '🔍' },
    { id: 'research', name: 'Research', icon: '📚' },
    { id: 'image-generation', name: 'Image Gen', icon: '🎨' },
    { id: 'code-review', name: 'Code Review', icon: '🔍' },
    { id: 'chart-visualization', name: 'Chart', icon: '📊' },
  ];

  return (
    <div className="p-2 border-t border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 mb-2 px-2">Available Skills</p>
      <div className="flex flex-wrap gap-1">
        {availableSkills.map((skill) => (
          <button
            key={skill.id}
            onClick={() => onAdd(skill)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Plus className="w-3 h-3" />
            {skill.icon} {skill.name}
          </button>
        ))}
      </div>
    </div>
  );
}

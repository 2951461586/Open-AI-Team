'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Rocket, BookOpen, MessageCircle, Settings, ChevronRight, CheckCircle2, Bot, Zap, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/context';

interface WelcomeScreenProps {
  onStartChat?: () => void;
  onOpenSettings?: () => void;
  onViewDocs?: () => void;
  onQuickStart?: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  completed: boolean;
}

const DEFAULT_STEPS: Step[] = [
  {
    id: 'api-key',
    title: '配置 API Key',
    description: '设置您的 LLM 提供商凭证',
    icon: Key,
    completed: false,
  },
  {
    id: 'model',
    title: '选择模型',
    description: '选择您偏好的 AI 模型',
    icon: Bot,
    completed: false,
  },
  {
    id: 'personality',
    title: '选择人格',
    description: '挑选适合您需求的 Agent 人格',
    icon: Sparkles,
    completed: false,
  },
  {
    id: 'first-task',
    title: '尝试首个任务',
    description: '从简单任务开始熟悉系统',
    icon: Rocket,
    completed: false,
  },
];

export function WelcomeScreen({
  onStartChat,
  onOpenSettings,
  onViewDocs,
  onQuickStart,
}: WelcomeScreenProps) {
  const { t } = useI18n();
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  const completeStep = useCallback((stepId: string) => {
    setSteps(prev => prev.map(s => 
      s.id === stepId ? { ...s, completed: true } : s
    ));
  }, []);

  const progress = (steps.filter(s => s.completed).length / steps.length) * 100;

  const tips = [
    {
      id: 'tl-first',
      title: 'TL-First 架构',
      content: '所有消息首先经过团队领导处理。TL 决定是直接回答还是委托给专业 Agent。',
    },
    {
      id: 'skills',
      title: '技能系统',
      content: '使用 /skills 命令浏览可用功能。技能采用渐进式加载以保持上下文精简。',
    },
    {
      id: 'memory',
      title: '记忆衰减',
      content: 'Agent 记忆会随时间自然衰减。近期交互保持清晰，而较早的记忆会逐渐淡忘。',
    },
  ];

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[var(--surface)] via-[var(--surface-subtle)] to-[var(--surface)]">
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-soft)] text-white mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-[var(--fg)] mb-2">
              {t('welcome.title', 'Welcome to AI Team')}
            </h1>
            <p className="text-[var(--fg-muted)] max-w-md mx-auto">
              {t('welcome.subtitle', 'Your AI-powered team assistant with planning, delegation, and evidence-driven delivery')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <button
              onClick={onStartChat}
              className="group flex flex-col items-center p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mb-4 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-[var(--fg)] mb-1">{t('welcome.startChat', 'Start Chat')}</h3>
              <p className="text-xs text-[var(--fg-muted)] text-center">{t('welcome.startChatDesc', 'Begin a conversation with your AI team')}</p>
              <ChevronRight className="w-4 h-4 text-[var(--accent)] mt-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={onQuickStart}
              className="group flex flex-col items-center p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--success-soft)] text-[var(--success)] mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-[var(--fg)] mb-1">{t('welcome.quickStart', 'Quick Start')}</h3>
              <p className="text-xs text-[var(--fg-muted)] text-center">{t('welcome.quickStartDesc', 'Try a guided example task')}</p>
              <ChevronRight className="w-4 h-4 text-[var(--accent)] mt-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={onOpenSettings}
              className="group flex flex-col items-center p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--warning-soft)] text-[var(--warning)] mb-4 group-hover:scale-110 transition-transform">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-[var(--fg)] mb-1">{t('welcome.settings', 'Settings')}</h3>
              <p className="text-xs text-[var(--fg-muted)] text-center">{t('welcome.settingsDesc', 'Configure your preferences')}</p>
              <ChevronRight className="w-4 h-4 text-[var(--accent)] mt-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--fg)]">{t('welcome.setupProgress', 'Setup Progress')}</h2>
                <span className="text-sm text-[var(--fg-muted)]">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-[var(--surface-subtle)] rounded-full mb-6 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--success)] rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="space-y-3">
                {steps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div 
                      key={step.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl transition-all',
                        step.completed 
                          ? 'bg-[var(--success-soft)]/30' 
                          : 'bg-[var(--surface-subtle)]'
                      )}
                    >
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        step.completed 
                          ? 'bg-[var(--success)] text-white' 
                          : 'bg-[var(--surface-muted)] text-[var(--fg-muted)]'
                      )}>
                        {step.completed ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium',
                          step.completed ? 'text-[var(--success)]' : 'text-[var(--fg)]'
                        )}>
                          {step.title}
                        </p>
                        <p className="text-xs text-[var(--fg-muted)] truncate">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-[var(--accent)]" />
                <h2 className="text-lg font-semibold text-[var(--fg)]">{t('welcome.tips', 'Tips')}</h2>
              </div>
              <div className="space-y-2">
                {tips.map((tip) => (
                  <div 
                    key={tip.id}
                    className="rounded-xl bg-[var(--surface-subtle)] overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedTip(expandedTip === tip.id ? null : tip.id)}
                      className="w-full flex items-center justify-between p-4 text-left"
                    >
                      <span className="font-medium text-[var(--fg)]">{tip.title}</span>
                      <ChevronRight className={cn(
                        'w-4 h-4 text-[var(--fg-muted)] transition-transform',
                        expandedTip === tip.id && 'rotate-90'
                      )} />
                    </button>
                    {expandedTip === tip.id && (
                      <div className="px-4 pb-4 pt-0 text-sm text-[var(--fg-muted)]">
                        {tip.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-8 py-4 bg-[var(--surface)]">
        <div className="flex items-center justify-between text-xs text-[var(--fg-muted)]">
          <span>{t('welcome.hint', 'Press Ctrl+/ to focus chat input')}</span>
          <div className="flex items-center gap-4">
            <button onClick={onViewDocs} className="hover:text-[var(--fg)] transition-colors">
              文档
            </button>
            <button onClick={onOpenSettings} className="hover:text-[var(--fg)] transition-colors">
              设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;

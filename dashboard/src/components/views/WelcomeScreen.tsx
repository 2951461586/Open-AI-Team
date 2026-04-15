'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Rocket, BookOpen, MessageCircle, Settings, ChevronRight, CheckCircle2, Bot, Zap } from 'lucide-react';
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
    title: 'Configure API Key',
    description: 'Set up your LLM provider credentials',
    icon: Key,
    completed: false,
  },
  {
    id: 'model',
    title: 'Select Model',
    description: 'Choose your preferred AI model',
    icon: Bot,
    completed: false,
  },
  {
    id: 'personality',
    title: 'Choose Personality',
    description: 'Pick an agent personality that suits your needs',
    icon: Sparkles,
    completed: false,
  },
  {
    id: 'first-task',
    title: 'Try First Task',
    description: 'Start with a simple task to get familiar',
    icon: Rocket,
    completed: false,
  },
];

function Key({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

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
      title: 'TL-First Architecture',
      content: 'All messages go through Team Leader first. TL decides whether to answer directly or delegate to specialized agents.',
    },
    {
      id: 'skills',
      title: 'Skills System',
      content: 'Use /skills command to browse available capabilities. Skills are loaded progressively to keep context lean.',
    },
    {
      id: 'memory',
      title: 'Memory Decay',
      content: 'Agent memory naturally decays over time. Recent interactions are kept sharp while older ones fade.',
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
              Documentation
            </button>
            <button onClick={onOpenSettings} className="hover:text-[var(--fg)] transition-colors">
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;

'use client'

import { useState, useCallback } from 'react'
import { Key, Globe, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/context'

interface ModelConfig {
  provider: string
  model: string
  maxRetries?: number
  apiKey?: string
  baseUrl?: string
}

interface ApiConfigState {
  chat: ModelConfig
  utility: ModelConfig
  reasoning: ModelConfig
}

const DEFAULT_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
  { id: 'ollama', name: 'Ollama (Local)', baseUrl: 'http://localhost:11434' },
]

export function ApiConfigPanel() {
  const { t } = useI18n()
  const [config, setConfig] = useState<ApiConfigState>({
    chat: { provider: 'openai', model: 'gpt-4o', maxRetries: 1 },
    utility: { provider: 'openai', model: 'gpt-4o-mini', maxRetries: 2 },
    reasoning: { provider: 'openai', model: 'gpt-4o-mini', maxRetries: 1 },
  })
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateModel = useCallback((role: keyof ApiConfigState, field: keyof ModelConfig, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      [role]: { ...prev[role], [field]: value }
    }))
    setSaved(false)
  }, [])

  const handleSave = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/v1/team/config/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, apiKey }),
      })
      if (!response.ok) throw new Error('Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }, [config, apiKey])

  const roles: { key: keyof ApiConfigState; label: string; desc: string }[] = [
    { key: 'chat', label: 'Chat Model', desc: 'Main conversation model' },
    { key: 'utility', label: 'Utility Model', desc: 'Lightweight tasks like summarization' },
    { key: 'reasoning', label: 'Reasoning Model', desc: 'Deep analysis and memory compilation' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fg)]">{t('api.config', 'API Configuration')}</h2>
          <p className="text-sm text-[var(--fg-muted)]">{t('api.configDesc', 'Configure your AI model providers and credentials')}</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-[var(--success)]">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">{t('api.saved', 'Saved')}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--danger-soft)] text-[var(--danger)]">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-[var(--fg-muted)]" />
            <span className="text-sm font-medium text-[var(--fg)]">{t('api.globalKey', 'Global API Key')}</span>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
            placeholder={t('api.keyPlaceholder', 'Enter your API key')}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-ghost)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {roles.map(({ key, label, desc }) => (
          <div key={key} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-[var(--fg)]">{label}</h3>
              <p className="text-xs text-[var(--fg-muted)]">{desc}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[var(--fg-muted)] mb-1">{t('api.provider', 'Provider')}</label>
                <select
                  value={config[key].provider}
                  onChange={(e) => updateModel(key, 'provider', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {DEFAULT_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--fg-muted)] mb-1">{t('api.model', 'Model')}</label>
                <input
                  type="text"
                  value={config[key].model}
                  onChange={(e) => updateModel(key, 'model', e.target.value)}
                  placeholder={t('api.modelPlaceholder', 'e.g., gpt-4o')}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-ghost)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--fg-muted)] mb-1">{t('api.maxRetries', 'Max Retries')}</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={config[key].maxRetries || 0}
                  onChange={(e) => updateModel(key, 'maxRetries', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs text-[var(--fg-muted)] mb-1">{t('api.baseUrl', 'Base URL (optional)')}</label>
              <input
                type="text"
                value={config[key].baseUrl || ''}
                onChange={(e) => updateModel(key, 'baseUrl', e.target.value)}
                placeholder={t('api.baseUrlPlaceholder', 'Leave empty for default')}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-ghost)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t('api.save', 'Save Configuration')}
        </button>
      </div>

      <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-[var(--fg-muted)]" />
          <span className="text-sm font-medium text-[var(--fg)]">{t('api.environment', 'Environment Variables')}</span>
        </div>
        <p className="text-xs text-[var(--fg-muted)] mb-2">{t('api.envDesc', 'You can also configure via environment variables:')}</p>
        <div className="space-y-1 font-mono text-xs">
          <div><span className="text-[var(--fg-muted)]">LLM_PROVIDER</span>=openai</div>
          <div><span className="text-[var(--fg-muted)]">LLM_MODEL</span>=gpt-4o-mini</div>
          <div><span className="text-[var(--fg-muted)]">OPENAI_API_KEY</span>=sk-...</div>
        </div>
      </div>
    </div>
  )
}

export default ApiConfigPanel

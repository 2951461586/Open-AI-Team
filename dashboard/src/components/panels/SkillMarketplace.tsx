'use client'

import { useState, useCallback } from 'react'
import { Search, Download, Check, Star, Bot, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/context'

interface Skill {
  id: string
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  category: string
  icon: string
  installed: boolean
  featured: boolean
}

interface Category {
  id: string
  name: string
}

interface SkillMarketplaceProps {
  onInstall?: (skillId: string) => void
}

const CATEGORIES: Category[] = [
  { id: 'all', name: '全部技能' },
  { id: 'research', name: '研究' },
  { id: 'development', name: '开发' },
  { id: 'productivity', name: '生产力' },
  { id: 'data', name: '数据' },
  { id: 'creative', name: '创意' },
]

const SKILLS: Skill[] = [
  { id: 'web-search', name: 'Web Search', description: 'Search the web for information', version: '1.0.0', author: 'AI Team', tags: ['search', 'research'], category: 'research', icon: '🔍', installed: true, featured: true },
  { id: 'research', name: 'Research', description: 'Comprehensive research workflow', version: '1.0.0', author: 'AI Team', tags: ['research', 'analysis'], category: 'research', icon: '📚', installed: true, featured: true },
  { id: 'report-generation', name: 'Report Generation', description: 'Generate structured reports', version: '1.0.0', author: 'AI Team', tags: ['writing', 'report'], category: 'productivity', icon: '📝', installed: false, featured: false },
  { id: 'code-review', name: 'Code Review', description: 'Review code for bugs and best practices', version: '1.0.0', author: 'AI Team', tags: ['code', 'review'], category: 'development', icon: '🔍', installed: false, featured: true },
  { id: 'image-generation', name: 'Image Generation', description: 'Generate visual images from text', version: '1.0.0', author: 'AI Team', tags: ['image', 'generation'], category: 'creative', icon: '🎨', installed: false, featured: true },
  { id: 'chart-visualization', name: 'Chart Visualization', description: 'Create charts and graphs', version: '1.0.0', author: 'AI Team', tags: ['chart', 'data'], category: 'data', icon: '📊', installed: false, featured: false },
  { id: 'slide-creation', name: 'Slide Creation', description: 'Create presentation slides', version: '1.0.0', author: 'AI Team', tags: ['slides', 'presentation'], category: 'productivity', icon: '📑', installed: false, featured: false },
  { id: 'skill-creator', name: 'Skill Creator', description: 'Create new skills', version: '1.0.0', author: 'AI Team', tags: ['meta', 'creator'], category: 'development', icon: '🛠️', installed: false, featured: false },
  { id: 'translation', name: 'Translation', description: 'Translate text between languages', version: '1.0.0', author: 'AI Team', tags: ['translation', 'language'], category: 'productivity', icon: '🌐', installed: false, featured: false },
  { id: 'document', name: 'Document Processor', description: 'Process documents in various formats', version: '1.0.0', author: 'AI Team', tags: ['document', 'processing'], category: 'productivity', icon: '📄', installed: false, featured: false },
  { id: 'data-analysis', name: 'Data Analysis', description: 'Analyze data arrays and objects', version: '1.0.0', author: 'AI Team', tags: ['data', 'analysis'], category: 'data', icon: '📈', installed: false, featured: true },
]

export function SkillMarketplace({ onInstall }: SkillMarketplaceProps) {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [installing, setInstalling] = useState<string | null>(null)
  const [installedSkills, setInstalledSkills] = useState<Set<string>>(new Set(['web-search', 'research', 'code-review']))

  const filteredSkills = SKILLS.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         skill.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const featuredSkills = SKILLS.filter(s => s.featured)

  const handleInstall = useCallback(async (skillId: string) => {
    setInstalling(skillId)
    setTimeout(() => {
      setInstalledSkills(prev => new Set(Array.from(prev).concat(skillId)))
      setInstalling(null)
      onInstall?.(skillId)
    }, 1000)
  }, [onInstall])

  return (
    <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Package className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[var(--fg)]">{t('skills.title', '技能中心')}</h2>
            <p className="text-xs text-[var(--fg-muted)]">{t('skills.available', '可用技能')}</p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索技能..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-all text-sm"
          />
        </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              'shrink-0 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
              selectedCategory === cat.id
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface-subtle)] text-[var(--fg-secondary)] hover:bg-[var(--surface-muted)]'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {selectedCategory === 'all' && !searchQuery && featuredSkills.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[var(--fg-muted)] mb-3">Featured</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {featuredSkills.slice(0, 2).map((skill) => (
              <div
                key={skill.id}
                className="p-4 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/20"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{skill.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[var(--fg)]">{skill.name}</h4>
                        {skill.featured && <Star className="h-4 w-4 text-[var(--warning)] fill-[var(--warning)]" />}
                      </div>
                      <p className="text-xs text-[var(--fg-muted)]">v{skill.version} · {skill.author}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[var(--fg-secondary)] mb-3">{skill.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {skill.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-[var(--surface)] text-[var(--fg-muted)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {installedSkills.has(skill.id) ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--success-soft)] text-[var(--success)]">
                      <Check className="h-3 w-3" />
                      {t('skills.installed', 'Installed')}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInstall(skill.id)}
                      disabled={installing === skill.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white disabled:opacity-50 transition-opacity"
                    >
                      <Download className="h-3 w-3" />
                      {installing === skill.id ? 'Installing...' : t('skills.install', 'Install')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-[var(--fg-muted)] mb-3">
          {selectedCategory === 'all' ? 'All Skills' : CATEGORIES.find(c => c.id === selectedCategory)?.name}
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className="group p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{skill.icon}</span>
                  <div>
                    <h4 className="font-semibold text-[var(--fg)]">{skill.name}</h4>
                    <p className="text-xs text-[var(--fg-muted)]">v{skill.version}</p>
                  </div>
                </div>
                {skill.featured && <Star className="h-4 w-4 text-[var(--warning)] fill-[var(--warning)]" />}
              </div>

              <p className="text-sm text-[var(--fg-secondary)] mb-4 line-clamp-2">{skill.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {skill.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 text-xs rounded bg-[var(--surface-subtle)] text-[var(--fg-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>

                {installedSkills.has(skill.id) ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-[var(--success-soft)] text-[var(--success)]">
                    <Check className="h-3.5 w-3.5" />
                    {t('skills.installed', 'Installed')}
                  </span>
                ) : (
                  <button
                    onClick={() => handleInstall(skill.id)}
                    disabled={installing === skill.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {installing === skill.id ? 'Installing...' : t('skills.install', 'Install')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredSkills.length === 0 && (
          <div className="flex items-center justify-center h-48 text-[var(--fg-muted)]">
            <Package className="h-12 w-12 mb-3 opacity-30" />
            <p>未找到技能</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SkillMarketplace

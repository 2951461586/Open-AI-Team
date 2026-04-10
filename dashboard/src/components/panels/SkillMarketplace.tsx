'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Download, Check, Star, Filter, Sparkles, Bot, Code, Palette, Database } from 'lucide-react'
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
  icon: string
}

interface SkillMarketplaceProps {
  apiEndpoint?: string
  onInstall?: (skillId: string) => void
}

const ICONS: Record<string, React.ReactNode> = {
  search: <Search className="h-5 w-5" />,
  research: <Sparkles className="h-5 w-5" />,
  code: <Code className="h-5 w-5" />,
  creative: <Palette className="h-5 w-5" />,
  data: <Database className="h-5 w-5" />,
}

export function SkillMarketplace({ apiEndpoint = '/api/skills/marketplace', onInstall }: SkillMarketplaceProps) {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [installing, setInstalling] = useState<string | null>(null)
  const [installedSkills, setInstalledSkills] = useState<Set<string>>(new Set(['web-search', 'research', 'code-review', 'image-generation', 'chart-visualization', 'data-analysis']))

  const categories: Category[] = [
    { id: 'all', name: 'All', icon: '🛍️' },
    { id: 'research', name: 'Research', icon: '📚' },
    { id: 'development', name: 'Development', icon: '💻' },
    { id: 'productivity', name: 'Productivity', icon: '⚡' },
    { id: 'data', name: 'Data', icon: '📊' },
    { id: 'creative', name: 'Creative', icon: '🎨' },
  ]

  const skills: Skill[] = [
    { id: 'web-search', name: 'Web Search', description: 'Search the web for information using search engines', version: '1.0.0', author: 'AI Team', tags: ['search', 'research', 'web'], category: 'research', icon: '🔍', installed: false, featured: true },
    { id: 'research', name: 'Research', description: 'Comprehensive research workflow combining web search and analysis', version: '1.0.0', author: 'AI Team', tags: ['research', 'analysis', 'compound'], category: 'research', icon: '📚', installed: false, featured: true },
    { id: 'report-generation', name: 'Report Generation', description: 'Generate structured reports from research findings', version: '1.0.0', author: 'AI Team', tags: ['writing', 'report', 'documentation'], category: 'productivity', icon: '📝', installed: false, featured: false },
    { id: 'code-review', name: 'Code Review', description: 'Review code for bugs, security issues, and best practices', version: '1.0.0', author: 'AI Team', tags: ['code', 'review', 'quality'], category: 'development', icon: '🔍', installed: false, featured: true },
    { id: 'image-generation', name: 'Image Generation', description: 'Generate visual images from text descriptions', version: '1.0.0', author: 'AI Team', tags: ['image', 'generation', 'ai'], category: 'creative', icon: '🎨', installed: false, featured: true },
    { id: 'chart-visualization', name: 'Chart Visualization', description: 'Create charts and graphs from data for visualization', version: '1.0.0', author: 'AI Team', tags: ['chart', 'visualization', 'data'], category: 'data', icon: '📊', installed: false, featured: false },
    { id: 'slide-creation', name: 'Slide Creation', description: 'Create presentation slides in various formats', version: '1.0.0', author: 'AI Team', tags: ['slides', 'presentation', 'ppt'], category: 'productivity', icon: '📑', installed: false, featured: false },
    { id: 'skill-creator', name: 'Skill Creator', description: 'Create and register new skills for the AI Team platform', version: '1.0.0', author: 'AI Team', tags: ['meta', 'creator', 'skill'], category: 'development', icon: '🛠️', installed: false, featured: false },
    { id: 'translation', name: 'Translation', description: 'Translate text between languages', version: '1.0.0', author: 'AI Team', tags: ['translation', 'language', 'i18n'], category: 'productivity', icon: '🌐', installed: false, featured: false },
    { id: 'document', name: 'Document Processor', description: 'Process documents in various formats', version: '1.0.0', author: 'AI Team', tags: ['document', 'processing', 'format'], category: 'productivity', icon: '📄', installed: false, featured: false },
    { id: 'data-analysis', name: 'Data Analysis', description: 'Analyze data arrays and objects', version: '1.0.0', author: 'AI Team', tags: ['data', 'analysis', 'statistics'], category: 'data', icon: '📈', installed: false, featured: true },
  ]

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         skill.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const featuredSkills = skills.filter(s => s.featured)

  const handleInstall = useCallback(async (skillId: string) => {
    setInstalling(skillId)
    setTimeout(() => {
      setInstalledSkills(prev => new Set([...prev, skillId]))
      setInstalling(null)
      onInstall?.(skillId)
    }, 1000)
  }, [onInstall])

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Skill Marketplace</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Extend your AI Team capabilities</p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {featuredSkills.length > 0 && selectedCategory === 'all' && !searchQuery && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Featured</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {featuredSkills.map((skill) => (
              <div
                key={skill.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{skill.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{skill.name}</h4>
                        {skill.featured && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">v{skill.version} · {skill.author}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{skill.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {skill.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-white/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {installedSkills.has(skill.id) ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      Installed
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInstall(skill.id)}
                      disabled={installing === skill.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow-sm disabled:opacity-50 transition-all"
                    >
                      <Download className="h-3 w-3" />
                      {installing === skill.id ? 'Installing...' : 'Install'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
          {selectedCategory === 'all' ? 'All Skills' : categories.find(c => c.id === selectedCategory)?.name}
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className="group p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-lg hover:shadow-gray-900/10 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{skill.icon}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{skill.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">v{skill.version}</p>
                  </div>
                </div>
                {skill.featured && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                {skill.description}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {skill.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>

                {installedSkills.has(skill.id) ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    Installed
                  </span>
                ) : (
                  <button
                    onClick={() => handleInstall(skill.id)}
                    disabled={installing === skill.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 shadow-sm disabled:opacity-50 transition-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {installing === skill.id ? 'Installing...' : 'Install'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredSkills.length === 0 && (
          <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No skills found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SkillMarketplace

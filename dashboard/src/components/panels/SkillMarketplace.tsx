'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Download, Check, Star, Filter } from 'lucide-react'
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

export function SkillMarketplace({ apiEndpoint = '/api/skills/marketplace', onInstall }: SkillMarketplaceProps) {
  const { t } = useI18n()
  const [skills, setSkills] = useState<Skill[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [installing, setInstalling] = useState<string | null>(null)

  const fetchSkills = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      if (searchQuery) params.set('search', searchQuery)
      
      const response = await fetch(`${apiEndpoint}?${params}`)
      if (!response.ok) throw new Error('Failed to fetch skills')
      const data = await response.json()
      setSkills(data.skills || [])
      setCategories(data.categories || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [apiEndpoint, selectedCategory, searchQuery])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const handleInstall = useCallback(async (skillId: string) => {
    setInstalling(skillId)
    try {
      const response = await fetch(`${apiEndpoint}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      })
      if (response.ok) {
        onInstall?.(skillId)
        fetchSkills()
      }
    } finally {
      setInstalling(null)
    }
  }, [apiEndpoint, onInstall, fetchSkills])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          {t('skills.marketplace', 'Skill Marketplace')}
        </h2>
        
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('skills.search', 'Search skills...')}
              className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition',
                selectedCategory === cat.id
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              )}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <p>{error}</p>
            <button
              onClick={fetchSkills}
              className="mt-2 px-4 py-2 bg-red-100 rounded-lg hover:bg-red-200"
            >
              {t('common.retry', 'Retry')}
            </button>
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>{t('skills.noResults', 'No skills found')}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="p-4 border rounded-lg dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{skill.icon}</span>
                    <div>
                      <h3 className="font-medium text-gray-800 dark:text-white">{skill.name}</h3>
                      <p className="text-xs text-gray-500">v{skill.version} · {skill.author}</p>
                    </div>
                  </div>
                  {skill.featured && (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                  {skill.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {skill.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  {skill.installed ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      {t('skills.installed', 'Installed')}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleInstall(skill.id)}
                      disabled={installing === skill.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      {installing === skill.id ? t('skills.installing', 'Installing...') : t('skills.install', 'Install')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SkillMarketplace

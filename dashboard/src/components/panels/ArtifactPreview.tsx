'use client'

import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

function guessLanguage(name = '', fallback = '') {
  const value = `${name}.${fallback}`.toLowerCase()
  if (value.includes('.ts') || value.includes('.tsx')) return 'typescript'
  if (value.includes('.js') || value.includes('.mjs') || value.includes('.cjs')) return 'javascript'
  if (value.includes('.json')) return 'json'
  if (value.includes('.py')) return 'python'
  if (value.includes('.sh')) return 'bash'
  if (value.includes('.md')) return 'markdown'
  if (value.includes('.css')) return 'css'
  if (value.includes('.html')) return 'markup'
  return fallback || 'text'
}

export function ArtifactPreview({ artifact }: { artifact: any }) {
  if (!artifact) return null
  const title = String(artifact.title || '未命名交付物')
  const path = String(artifact.path || '')
  const mimeType = String(artifact.mimeType || '')
  const previewText = String(artifact.previewText || '')
  const language = guessLanguage(path || title, String(artifact.language || ''))
  const isImage = mimeType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(path)
  const isMarkdown = language === 'markdown'
  const isJson = language === 'json'
  const isCode = ['typescript', 'javascript', 'python', 'bash', 'json', 'css', 'markup'].includes(language)

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--fg)]">{title}</div>
        <div className="mt-1 text-xs text-[var(--fg-muted)]">{path || artifact.artifactType || 'artifact'}</div>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        {isImage && path ? (
          <div className="relative min-h-[18rem] w-full bg-[var(--surface-subtle)]">
            <Image src={path} alt={title} fill className="object-contain" unoptimized />
          </div>
        ) : isMarkdown ? (
          <div className="prose prose-sm max-w-none px-4 py-4 text-[var(--fg)] prose-pre:hidden">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewText || '_空内容_'}</ReactMarkdown>
          </div>
        ) : isJson || isCode ? (
          <SyntaxHighlighter language={language} style={oneDark} customStyle={{ margin: 0, background: 'transparent', fontSize: '12px' }} wrapLongLines>
            {previewText || '{}'}
          </SyntaxHighlighter>
        ) : (
          <pre className="whitespace-pre-wrap break-words px-4 py-4 text-xs leading-6 text-[var(--fg)]">{previewText || '暂无可预览内容'}</pre>
        )}
      </div>
    </div>
  )
}

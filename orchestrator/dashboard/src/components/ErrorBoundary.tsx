'use client'

import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex h-screen items-center justify-center bg-[var(--bg)] p-6">
          <div className="max-w-md rounded-2xl border border-[var(--danger)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="mb-3 text-lg font-semibold text-[var(--danger)]">⚠️ 出错了</div>
            <p className="text-sm text-[var(--fg-secondary)]">{this.state.error?.message || '未知错误'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] hover:bg-[var(--surface-muted)] transition"
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

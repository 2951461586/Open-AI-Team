'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface UseWebSocketOptions {
  url: string
  onMessage?: (data: any) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const stoppedRef = useRef(false)
  const callbacksRef = useRef({ onMessage, onOpen, onClose, onError })

  useEffect(() => {
    callbacksRef.current = { onMessage, onOpen, onClose, onError }
  }, [onMessage, onOpen, onClose, onError])

  const connect = useCallback(() => {
    if (stoppedRef.current) return
    if (!url) return
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        reconnectAttemptsRef.current = 0
        callbacksRef.current.onOpen?.()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          callbacksRef.current.onMessage?.(data)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        callbacksRef.current.onClose?.()

        if (!stoppedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, reconnectInterval)
        }
      }

      ws.onerror = (error) => {
        callbacksRef.current.onError?.(error)
      }
    } catch (error) {
      console.error('WebSocket connection error:', error)
    }
  }, [url, reconnectInterval, maxReconnectAttempts])

  const disconnect = useCallback(() => {
    stoppedRef.current = true
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
    setConnected(false)
  }, [])

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
      return true
    }
    return false
  }, [])

  useEffect(() => {
    stoppedRef.current = false
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return { connected, send, disconnect, reconnect: connect }
}

import { useState, useRef, useCallback } from 'react'
import { initSession, sendChatMessage } from '../lib/supabase'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Progress {
  percent: number
  required_done: number
  required_total: number
}

const useChat = (businessSlug: string) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>({ percent: 0, required_done: 0, required_total: 0 })
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  const initialize = useCallback(async () => {
    if (initRef.current) return
    initRef.current = true

    setIsLoading(true)
    setError(null)

    try {
      const data = await initSession(businessSlug)
      setSessionId(data.session_id)

      if (data.message) {
        setMessages([{ role: 'assistant', content: data.message }])
      }

      if (data.progress) {
        setProgress(data.progress)
      }
    } catch {
      setError('Unable to connect. Please try again later.')
      initRef.current = false
    } finally {
      setIsLoading(false)
    }
  }, [businessSlug])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || completed) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      const data = await sendChatMessage(businessSlug, sessionId!, text.trim())

      if (data.session_id && !sessionId) {
        setSessionId(data.session_id)
      }

      if (data.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])
      }

      if (data.progress) {
        setProgress(data.progress)
      }

      if (data.completed) {
        setCompleted(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [businessSlug, sessionId, isLoading, completed])

  return { messages, isLoading, sessionId, progress, completed, error, initialize, sendMessage }
}

export default useChat

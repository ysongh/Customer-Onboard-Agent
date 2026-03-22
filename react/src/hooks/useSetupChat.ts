import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

const useSetupChat = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [shareableLink, setShareableLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  const callSetupFunction = useCallback(async (message: string | null, currentSessionId: string | null) => {
    const { data, error } = await supabase.functions.invoke('business-setup', {
      body: {
        message,
        session_id: currentSessionId,
      },
    })

    if (error) throw new Error(error.message || 'Failed to call setup function')
    return data
  }, [])

  const initialize = useCallback(async () => {
    if (initRef.current) return
    initRef.current = true

    setIsLoading(true)
    setError(null)

    try {
      const data = await callSetupFunction(null, null)
      setSessionId(data.session_id)

      if (data.message) {
        setMessages([{ role: 'assistant', content: data.message }])
      }
    } catch {
      setError('Unable to connect. Please try again later.')
      initRef.current = false
    } finally {
      setIsLoading(false)
    }
  }, [callSetupFunction])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || completed) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      const data = await callSetupFunction(text.trim(), sessionId)

      if (data.session_id && !sessionId) {
        setSessionId(data.session_id)
      }

      if (data.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])
      }

      if (data.completed) {
        setCompleted(true)
        if (data.shareable_link) {
          setShareableLink(data.shareable_link)
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, isLoading, completed, callSetupFunction])

  return { messages, isLoading, sessionId, completed, shareableLink, error, initialize, sendMessage }
}

export default useSetupChat

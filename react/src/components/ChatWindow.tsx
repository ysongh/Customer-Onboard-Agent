import { useEffect, useRef } from 'react'
import useChat from '../hooks/useChat'
import ProgressBar from './ProgressBar'
import ChatMessage from './ChatMessage'
import TypingIndicator from './TypingIndicator'
import ChatInput from './ChatInput'

interface ChatWindowProps {
  businessSlug: string
}

const ChatWindow = ({ businessSlug }: ChatWindowProps) => {
  const { messages, isLoading, progress, completed, error, initialize, sendMessage } = useChat(businessSlug)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex flex-col h-screen max-w-[480px] mx-auto w-full bg-white dark:bg-gray-900 shadow-lg">
      <ProgressBar progress={progress} completed={completed} />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        {error && (
          <div className="text-center text-sm text-red-500 dark:text-red-400 py-2">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={sendMessage} disabled={isLoading} completed={completed} />
    </div>
  )
}

export default ChatWindow

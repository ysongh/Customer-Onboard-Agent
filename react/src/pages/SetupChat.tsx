import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useSetupChat from '../hooks/useSetupChat'
import ChatMessage from '../components/ChatMessage'
import ChatInput from '../components/ChatInput'
import TypingIndicator from '../components/TypingIndicator'

const SetupChat = () => {
  const { messages, isLoading, completed, shareableLink, error, initialize, sendMessage } = useSetupChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const fullLink = shareableLink ? `${window.location.origin}${shareableLink}` : null

  const handleCopy = async () => {
    if (!fullLink) return
    await navigator.clipboard.writeText(fullLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-screen max-w-[480px] mx-auto w-full bg-white dark:bg-gray-900 shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Set up your onboarding
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tell the assistant about your business and what info you need from customers
        </p>
      </div>

      {/* Messages */}
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

      {/* Completion: shareable link + go to dashboard */}
      {completed && fullLink && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 space-y-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Your onboarding link is ready:
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={fullLink}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
            />
            <button
              onClick={handleCopy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shrink-0"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      )}

      {/* Input (hidden when completed) */}
      {!completed && (
        <ChatInput onSend={sendMessage} disabled={isLoading} completed={completed} />
      )}
    </div>
  )
}

export default SetupChat

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchCustomerDetail } from '../lib/api'

interface Customer {
  id: string
  name: string | null
  email: string | null
  custom_fields: Record<string, unknown>
  status: string
  created_at: string
}

interface ConversationEntry {
  role: string
  content: string
  sent_at: string
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

const CustomerDetail = () => {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [conversation, setConversation] = useState<ConversationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!customerId) return

    const load = async () => {
      try {
        const data = await fetchCustomerDetail(customerId)
        setCustomer(data.customer)
        setConversation(data.conversation)
      } catch {
        setError('Failed to load customer details.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [customerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-500">{error || 'Customer not found.'}</p>
      </div>
    )
  }

  const fields = Object.entries(customer.custom_fields || {})

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-6 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        &larr; Back to dashboard
      </button>

      {/* Customer header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {customer.name || 'Unnamed customer'}
          </h1>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[customer.status] || ''}`}
          >
            {customer.status}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Onboarded {formatDateTime(customer.created_at)}
        </p>
      </div>

      {/* Collected fields */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Collected information
        </h2>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {fields.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No fields collected.
            </div>
          ) : (
            fields.map(([key, value]) => (
              <div key={key} className="flex px-4 py-3">
                <span className="w-40 shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">
                  {key}
                </span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {String(value)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation transcript */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Conversation transcript
        </h2>
        {conversation.length === 0 ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No conversation recorded.
          </div>
        ) : (
          <div className="space-y-3">
            {conversation.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[80%] text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 px-1">
                  {formatDateTime(msg.sent_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerDetail

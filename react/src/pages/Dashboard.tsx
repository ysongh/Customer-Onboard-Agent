import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { fetchOwnerBusiness, fetchDashboardCustomers, fetchStats, fetchBusinessSchema } from '../lib/api'

interface Customer {
  id: string
  name: string | null
  email: string | null
  custom_fields: Record<string, unknown>
  status: string
  created_at: string
}

interface SchemaField {
  field_name: string
  field_label: string
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [business, setBusiness] = useState<Record<string, unknown> | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [schema, setSchema] = useState<SchemaField[]>([])
  const [stats, setStats] = useState({ totalCustomers: 0, inProgress: 0, abandoned: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return

    const load = async () => {
      try {
        const biz = await fetchOwnerBusiness(user.id)
        if (!biz) {
          navigate('/setup')
          return
        }
        setBusiness(biz)

        const [custs, statsData, schemaData] = await Promise.all([
          fetchDashboardCustomers(biz.id),
          fetchStats(biz.id),
          fetchBusinessSchema(biz.id),
        ])

        setCustomers(custs)
        setStats(statsData)
        setSchema(schemaData)
      } catch (err) {
        console.error('Dashboard load error:', err)
        const message = err instanceof Error ? err.message : String(err)
        setError(`Failed to load dashboard data: ${message}`)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user, navigate])

  const dynamicFields = schema.filter(
    (f) => f.field_name !== 'name' && f.field_name !== 'email',
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.toLowerCase()
    return customers.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q),
    )
  }, [customers, search])

  const shareableLink = business
    ? `${window.location.origin}/onboard/${business.slug}`
    : null

  const handleCopy = async () => {
    if (!shareableLink) return
    await navigator.clipboard.writeText(shareableLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {business?.name as string}
          </h1>
        </div>
        {shareableLink && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">Onboarding link:</span>
            <code className="text-sm bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5 text-gray-700 dark:text-gray-300">
              {shareableLink}
            </code>
            <button
              onClick={handleCopy}
              className="rounded px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCustomers}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Customers onboarded</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inProgress}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">In progress</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.abandoned}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Abandoned</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full max-w-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {search ? 'No matching customers.' : 'No customers yet. Share your onboarding link to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Email
                </th>
                {dynamicFields.map((field) => (
                  <th
                    key={field.field_name}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    {field.field_label}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => navigate(`/dashboard/${customer.id}`)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {customer.name || '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {customer.email || '\u2014'}
                  </td>
                  {dynamicFields.map((field) => (
                    <td
                      key={field.field_name}
                      className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300"
                    >
                      {String(customer.custom_fields?.[field.field_name] ?? '\u2014')}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[customer.status] || ''}`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(customer.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Dashboard

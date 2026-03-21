import { useState, useEffect } from 'react'
import { fetchCustomers } from '../lib/supabase'

export interface SchemaField {
  field_name: string
  field_label: string
  field_type: string
  required: boolean
  sort_order: number
}

export interface CustomerRecord {
  id: string
  name: string | null
  email: string | null
  custom_fields: Record<string, unknown>
  status: 'active' | 'pending' | 'archived'
  created_at: string
}

const useCustomers = (businessSlug: string) => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [schema, setSchema] = useState<SchemaField[]>([])
  const [businessName, setBusinessName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchCustomers(businessSlug)
        setBusinessName(data.business.name)
        setSchema(data.schema)
        setCustomers(data.customers)
      } catch {
        setError('Failed to load customer data.')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [businessSlug])

  return { customers, schema, businessName, isLoading, error }
}

export default useCustomers

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const initSession = async (businessSlug: string) => {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: {
      business_slug: businessSlug,
      message: null,
    },
  })

  if (error) throw new Error(error.message || 'Failed to initialize session')
  return data
}

export const fetchCustomers = async (businessSlug: string) => {
  const { data, error } = await supabase.functions.invoke('customers', {
    body: { business_slug: businessSlug },
  })

  if (error) throw new Error(error.message || 'Failed to fetch customers')
  return data
}

export const sendChatMessage = async (businessSlug: string, sessionId: string, message: string) => {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: {
      business_slug: businessSlug,
      session_id: sessionId,
      message,
    },
  })

  if (error) throw new Error(error.message || 'Failed to send message')
  return data
}

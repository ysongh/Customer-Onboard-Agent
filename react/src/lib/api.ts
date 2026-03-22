import { supabase } from './supabase'

export const fetchDashboardCustomers = async (businessId: string) => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const fetchCustomerDetail = async (customerId: string) => {
  // Fetch customer
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  if (custError) throw custError

  // Fetch the conversation log via the onboarding session
  const { data: session } = await supabase
    .from('onboarding_sessions')
    .select('id')
    .eq('customer_id', customerId)
    .single()

  let conversation: { role: string; content: string; sent_at: string }[] = []
  if (session) {
    const { data: messages } = await supabase
      .from('conversation_log')
      .select('role, content, sent_at')
      .eq('session_id', session.id)
      .order('sent_at', { ascending: true })

    conversation = messages || []
  }

  return { customer, conversation }
}

export const fetchStats = async (businessId: string) => {
  const [customersRes, inProgressRes, abandonedRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId),
    supabase
      .from('onboarding_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('state', 'in_progress'),
    supabase
      .from('onboarding_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('state', 'abandoned'),
  ])

  return {
    totalCustomers: customersRes.count ?? 0,
    inProgress: inProgressRes.count ?? 0,
    abandoned: abandonedRes.count ?? 0,
  }
}

export const fetchOwnerBusiness = async (ownerId: string) => {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', ownerId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export const fetchBusinessSchema = async (businessId: string) => {
  const { data, error } = await supabase
    .from('onboarding_schema')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order')

  if (error) throw error
  return data || []
}

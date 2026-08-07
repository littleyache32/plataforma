import { createClient } from '@supabase/supabase-js'

let client

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase nao configurado no ambiente do servidor.')
  }

  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return client
}


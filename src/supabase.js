// These are Supabase's browser-safe project credentials. Database access is
// restricted to the RPC functions in supabase/schema.sql.
const supabaseUrl = 'https://nmaqokwajzzjolgxiuqz.supabase.co'
const supabaseKey = 'sb_publishable_3vyiwJGoLo6iBNyFiswKoQ_vVwAapmi'

export async function ballotRpc(name, args = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })

  if (!response.ok) throw new Error('Unable to verify that PIN. Please try again.')
  return response.json()
}

export async function adminSignIn(email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error('That email or password is not correct.')
  return response.json()
}

export async function adminRequest(path, accessToken, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) throw new Error('Admin request was not allowed. Please sign in again.')
  return response.status === 204 ? null : response.json()
}

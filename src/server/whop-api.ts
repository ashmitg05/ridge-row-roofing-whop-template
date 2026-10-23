export async function whopRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const origin = process.env.WHOP_API_ORIGIN || 'https://api.whop.com'
  const headers = new Headers(init.headers)
  headers.set('Api-Version-Date', '2026-10-15-1')
  if (process.env.WHOP_API_KEY) headers.set('Authorization', `Bearer ${process.env.WHOP_API_KEY}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${origin}/api/v1${path}`, { ...init, headers, signal: AbortSignal.timeout(20000) })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string }
    console.error('Payment API request failed', path.split('?')[0], response.status, error.error?.message || error.message || 'No validation message')
    throw new Error(`The payment provider could not complete this request (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export type WhopIdentity = { sub: string; email?: string; name?: string }

export async function readWhopIdentity(accessToken: string): Promise<WhopIdentity> {
  if (typeof accessToken !== 'string' || accessToken.length < 12 || accessToken.length > 12000) throw new Error('Please sign in securely.')
  const response = await fetch('https://api.whop.com/oauth/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}`, 'x-whop-inject-key': 'none' },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error('Account sign-in expired. Please sign in again.')
  const identity = await response.json() as WhopIdentity
  if (!identity.sub?.startsWith('user_')) throw new Error('The payment provider could not verify this account.')
  return identity
}

export async function requireOperator(accessToken: string): Promise<WhopIdentity> {
  const identity = await readWhopIdentity(accessToken)
  const allowed = (process.env.WHOP_OPERATOR_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean)
  if (!allowed.includes(identity.sub)) throw new Error('This account does not have operator access.')
  return identity
}

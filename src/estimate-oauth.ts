import { site } from './site-config'
import type { EstimateInput } from './server/estimate'

const storageKey = 'ridge-row-estimate-oauth'
const redirectUri = `${site.baseUrl}/oauth/callback`

type Pending = { state: string; verifier: string; purpose: 'estimate'; estimate: EstimateInput } | { state: string; verifier: string; purpose: 'operator' }

export const operatorStorageKey = 'ridge-row-operator-session'

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function randomString(length: number) {
  return base64url(crypto.getRandomValues(new Uint8Array(length)))
}

async function startSignIn(intent: { purpose: 'estimate'; estimate: EstimateInput } | { purpose: 'operator' }) {
  const verifier = randomString(32)
  const state = randomString(16)
  const nonce = randomString(16)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  sessionStorage.setItem(storageKey, JSON.stringify({ state, verifier, ...intent } satisfies Pending))
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: site.appId,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: base64url(digest),
    code_challenge_method: 'S256',
  })
  window.location.assign(`https://api.whop.com/oauth/authorize?${params}`)
}

export function startEstimateSignIn(estimate: EstimateInput) {
  return startSignIn({ purpose: 'estimate', estimate: { ...estimate, requestId: crypto.randomUUID() } })
}

export function startOperatorSignIn() { return startSignIn({ purpose: 'operator' }) }

export async function completeWhopSignIn(): Promise<{ token: string; intent: Pending }> {
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  if (error) throw new Error('Account sign-in was cancelled or declined. Please try again.')
  const code = params.get('code')
  const state = params.get('state')
  const pending = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as Pending | null
  sessionStorage.removeItem(storageKey)
  window.history.replaceState({}, '', window.location.pathname)
  if (!code || !pending || !state || state !== pending.state) throw new Error('The sign-in session expired. Please submit the estimate form again.')
  const response = await fetch('https://api.whop.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: site.appId,
      redirect_uri: redirectUri,
      code,
      code_verifier: pending.verifier,
    }),
  })
  if (!response.ok) throw new Error('Account sign-in could not be completed. Please submit the estimate form again.')
  const token = await response.json() as { access_token?: string }
  if (!token.access_token) throw new Error('The payment provider did not return a sign-in token.')
  return { token: token.access_token, intent: pending }
}

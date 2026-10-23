import { createServerFn } from '@tanstack/react-start'
import { site, type CheckoutItem } from '../site-config'

async function idempotencyKey(prefix: string, token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return `${prefix}-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function whopApi() {
  const origin = process.env.WHOP_API_ORIGIN || 'https://api.whop.com'
  const token = process.env.WHOP_API_KEY
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  return { origin, authHeaders }
}

export const createServicePayment = createServerFn({ method: 'POST' })
  .validator((input: { confirmationToken: string; item: CheckoutItem }) => input)
  .handler(async ({ data }) => {
    if (!['inspection', 'deposit', 'repair'].includes(data.item) || !/^ctok_[A-Za-z0-9]+$/.test(data.confirmationToken)) {
      throw new Error('Invalid checkout request.')
    }
    const { origin, authHeaders } = whopApi()
    const response = await fetch(`${origin}/api/v1/payments`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': await idempotencyKey('roofing-payment', data.confirmationToken) },
      body: JSON.stringify({ account_id: site.accountId, plan_id: site.plans[data.item], confirmation_token: data.confirmationToken, return_url: `${site.baseUrl}/checkout/return?item=${data.item}`, metadata: { template: 'ridge_row_roofing', service: data.item } }),
    })
    if (!response.ok) {
      console.error('payment create failed', response.status)
      throw new Error('The payment provider could not start the charge. Please try another method.')
    }
    const payment = await response.json() as { id: string; status: string; client_secret: string | null }
    return { id: payment.id, status: payment.status, client_secret: payment.client_secret }
  })

type Payment = { id?: string; status?: string; account_id?: string; company?: { id?: string }; plan_id?: string; plan?: { id?: string }; line_items?: Array<{ plan_id?: string }> }

async function getPayment(paymentId: string, item: CheckoutItem): Promise<Payment | null> {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) return null
  const { origin, authHeaders } = whopApi()
  const response = await fetch(`${origin}/api/v1/payments/${paymentId}`, { headers: authHeaders })
  if (!response.ok) { console.warn('payment lookup failed', response.status); return null }
  const payment = await response.json() as Payment
  const accountId = payment.account_id || payment.company?.id
  const matchesPlan = payment.plan_id === site.plans[item] || payment.plan?.id === site.plans[item] || payment.line_items?.some((line) => line.plan_id === site.plans[item])
  return accountId === site.accountId && matchesPlan && payment.status === 'paid' ? payment : null
}

export const verifyServicePayment = createServerFn({ method: 'POST' })
  .validator((input: { paymentId: string; item: CheckoutItem }) => input)
  .handler(async ({ data }) => ({ paid: ['inspection', 'deposit', 'repair'].includes(data.item) && !!(await getPayment(data.paymentId, data.item)) }))

export const verifyDepositPayment = createServerFn({ method: 'POST' })
  .validator((input: { paymentId: string }) => input)
  .handler(async ({ data }) => ({ paid: !!(await getPayment(data.paymentId, 'deposit')) }))

export const verifyCardSetupIntent = createServerFn({ method: 'POST' })
  .validator((input: { setupId: string; depositPaymentId: string }) => input)
  .handler(async ({ data }) => {
    if (!/^sint_[A-Za-z0-9]+$/.test(data.setupId) || !(await getPayment(data.depositPaymentId, 'deposit'))) return { saved: false }
    const { origin, authHeaders } = whopApi()
    const response = await fetch(`${origin}/api/v1/setup_intents/${data.setupId}`, { headers: authHeaders })
    if (!response.ok) return { saved: false }
    const setup = await response.json() as { account_id?: string; company?: { id?: string }; status?: string; payment_method_id?: string; payment_method?: { id?: string }; metadata?: { deposit_payment_id?: string } }
    return { saved: (setup.account_id || setup.company?.id) === site.accountId && setup.status === 'succeeded' && !!(setup.payment_method_id || setup.payment_method?.id) && setup.metadata?.deposit_payment_id === data.depositPaymentId }
  })

export const createCardSetupIntent = createServerFn({ method: 'POST' })
  .validator((input: { paymentId: string; confirmationToken: string }) => input)
  .handler(async ({ data }) => {
    if (!/^ctok_[A-Za-z0-9]+$/.test(data.confirmationToken) || !(await getPayment(data.paymentId, 'deposit'))) {
      throw new Error('A confirmed deposit and a valid payment token are required.')
    }
    const { origin, authHeaders } = whopApi()
    const response = await fetch(`${origin}/api/v1/setup_intents`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': await idempotencyKey('roofing-setup', data.confirmationToken) },
      body: JSON.stringify({ account_id: site.accountId, confirmation_token: data.confirmationToken, currency: 'usd', return_url: `${site.baseUrl}/checkout/return?mode=save&deposit_payment=${data.paymentId}`, metadata: { deposit_payment_id: data.paymentId, template: 'ridge_row_roofing' } }),
    })
    if (!response.ok) {
      console.error('payment authorization create failed', response.status)
      throw new Error('The payment provider could not create the setup intent. Please try again.')
    }
    const setup = await response.json() as { id: string; status: string; client_secret: string | null }
    return { id: setup.id, status: setup.status, client_secret: setup.client_secret }
  })

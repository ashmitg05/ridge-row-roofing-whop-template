import { createServerFn } from '@tanstack/react-start'
import { site } from '../site-config'

export type EstimateInput = {
  name: string
  email: string
  phone: string
  zip: string
  service: string
  message: string
  website?: string
  accessToken?: string
}

export const submitEstimate = createServerFn({ method: 'POST' })
  .validator((input: EstimateInput) => input)
  .handler(async ({ data }) => {
    const clean = {
      name: data.name.trim().slice(0, 100),
      email: data.email.trim().toLowerCase().slice(0, 254),
      phone: data.phone.trim().slice(0, 40),
      zip: data.zip.trim().slice(0, 10),
      service: data.service.trim().slice(0, 60),
      message: data.message.trim().slice(0, 1500),
    }
    if (data.website) return { ok: true, leadId: '' }
    if (!clean.name || !/^\S+@\S+\.\S+$/.test(clean.email) || !clean.phone || !/^\d{5}(?:-\d{4})?$/.test(clean.zip) || !clean.service) {
      throw new Error('Please complete every required field with a valid email and US ZIP code.')
    }
    if (!data.accessToken) throw new Error('Please sign in with Whop to submit this request.')
    const userResponse = await fetch('https://api.whop.com/oauth/userinfo', {
      headers: { Authorization: `Bearer ${data.accessToken}`, 'x-whop-inject-key': 'none' },
    })
    if (!userResponse.ok) throw new Error('Whop sign-in expired. Please submit the form again.')
    const user = await userResponse.json() as { sub?: string }
    if (!user.sub?.startsWith('user_')) throw new Error('Whop could not identify the signed-in user.')
    const apiOrigin = process.env.WHOP_API_ORIGIN || 'https://api.whop.com'
    const localToken = process.env.WHOP_API_KEY
    const response = await fetch(`${apiOrigin}/api/v1/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(localToken ? { Authorization: `Bearer ${localToken}` } : {}) },
      body: JSON.stringify({ user_id: user.sub, account_id: process.env.WHOP_ACCOUNT_ID || site.accountId, metadata: { ...clean, source: 'roofing_website_estimate', template_demo: true } }),
    })
    if (!response.ok) {
      console.error('Whop Leads create failed', response.status)
      throw new Error('Whop could not save this estimate request. Please try again later.')
    }
    const lead = await response.json() as { id: string }
    return { ok: true, leadId: lead.id }
  })

import { createServerFn } from '@tanstack/react-start'
import { site } from '../site-config'
import { readWhopIdentity, whopRequest } from './whop-api'
import { deliverEmail, type EmailResult } from './email'

export type EstimateInput = {
  name: string
  email: string
  phone: string
  zip: string
  service: string
  message: string
  website?: string
  accessToken?: string
  requestId?: string
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
    if (data.website) return { ok: true, leadId: '', email: { status: 'restricted' } as EmailResult }
    if (!clean.name || !/^\S+@\S+\.\S+$/.test(clean.email) || !clean.phone || !/^\d{5}(?:-\d{4})?$/.test(clean.zip) || !clean.service) {
      throw new Error('Please complete every required field with a valid email and US ZIP code.')
    }
    if (!data.accessToken) throw new Error('Please sign in securely to submit this request.')
    const user = await readWhopIdentity(data.accessToken)
    const requestId = /^[A-Za-z0-9-]{16,80}$/.test(data.requestId || '') ? data.requestId! : crypto.randomUUID()
    const lead = await whopRequest<{ id: string }>('/leads', {
      method: 'POST',
      headers: { 'Idempotency-Key': `roofing-lead-${user.sub}-${requestId}` },
      body: JSON.stringify({ user_id: user.sub, account_id: site.accountId, metadata: { ...clean, source: 'roofing_website_estimate', template_demo: true, request_id: requestId } }),
    })
    // A successful Lead must remain successful even if the email provider is unavailable.
    const email: EmailResult = user.email?.toLowerCase() === clean.email
      ? await deliverEmail({ to: clean.email, subject: `${site.company}: estimate request received`, title: 'We received your estimate request.', paragraphs: [`Hello ${clean.name},`, `Your request for ${clean.service.toLowerCase()} in ZIP ${clean.zip} is saved in estimate requests.`, `Your reference: ${lead.id}.`, 'This is a roofing website template demonstration. No appointment or roofing service has been booked.'], idempotencyKey: `roofing-estimate-${user.sub}-${requestId}` })
      : { status: 'restricted' }
    return { ok: true, leadId: lead.id, email }
  })

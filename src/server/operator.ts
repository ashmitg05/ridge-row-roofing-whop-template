import { createServerFn } from '@tanstack/react-start'
import { site } from '../site-config'
import { deliverInvoiceEmail } from './email'
import { safeWhopPayUrl, validateManualInvoice, type ManualInvoiceInput } from './invoice-input'
import { requireOperator, whopRequest } from './whop-api'

type LeadRecord = { id: string; created_at: string; metadata?: Record<string, unknown>; user?: { name?: string; email?: string } }
type EventRecord = { id: string; event_name: string; custom_name?: string; event_time: string; path?: string; url?: string; value?: number }
type InvoiceRecord = { id: string; status: string; created_at?: string; customer_name?: string; email_address?: string; pay_online_url?: string; company?: { id: string }; account_id?: string; collection_method?: string; product?: { title?: string }; line_items?: Array<{ label?: string; unit_price: number; quantity: number; total?: number }> }
type PaymentRecord = { id: string; status: string; created_at: string; total?: number; total_usd_amount?: number; final_amount?: number; plan?: { title?: string }; product?: { title?: string } }
type Page<T> = { data?: T[]; page_info?: { has_next_page?: boolean } }

function invoiceSummary(invoice: InvoiceRecord) {
  return { id: invoice.id, status: invoice.status, createdAt: invoice.created_at || '', customerName: invoice.customer_name || '', email: invoice.email_address || '', title: invoice.product?.title || 'Roofing final balance', amount: (invoice.line_items || []).reduce((sum, row) => sum + (row.total ?? row.unit_price * row.quantity), 0), payUrl: safeWhopPayUrl(invoice.pay_online_url), collectionMethod: invoice.collection_method || 'send_invoice' }
}

export const getOperatorData = createServerFn({ method: 'POST' })
  .validator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireOperator(data.accessToken)
    const account = encodeURIComponent(site.accountId)
    const to = new Date().toISOString()
    const from = new Date(Date.now() - 30 * 86400000).toISOString()
    const results = await Promise.allSettled([
      whopRequest<Page<LeadRecord>>(`/leads?account_id=${account}&first=50`),
      whopRequest<Page<InvoiceRecord>>(`/invoices?account_id=${account}&first=25&order=created_at&direction=desc`),
      whopRequest<Page<EventRecord>>(`/events?${new URLSearchParams({ account_id: site.accountId, from, to, first: '200', hostname: new URL(site.baseUrl).hostname })}`),
      whopRequest<Page<PaymentRecord>>(`/payments?account_id=${account}&first=10&order=created_at&direction=desc`),
    ])
    const read = <T,>(index: number): { rows: T[]; error: string | null; more: boolean } => {
      const result = results[index]
      if (result.status === 'rejected') return { rows: [], error: result.reason instanceof Error ? result.reason.message : 'This account feed is unavailable.', more: false }
      const page = result.value as Page<T>
      return { rows: page.data || [], error: null, more: !!page.page_info?.has_next_page }
    }
    const leads = read<LeadRecord>(0), invoices = read<InvoiceRecord>(1), events = read<EventRecord>(2), payments = read<PaymentRecord>(3)
    return {
      operator: { name: user.name || 'Website operator', email: user.email || '' }, fetchedAt: to,
      email: { configured: !!process.env.RESEND_API_KEY, testRecipient: process.env.EMAIL_TEST_RECIPIENT || null, from: process.env.EMAIL_FROM || null },
      leads: { ...leads, rows: leads.rows.map(lead => { const meta = lead.metadata || {}; return { id: lead.id, createdAt: lead.created_at, name: String(meta.name || lead.user?.name || 'Estimate request'), email: String(meta.email || lead.user?.email || ''), phone: String(meta.phone || ''), zip: String(meta.zip || ''), service: String(meta.service || ''), message: String(meta.message || '') } }) },
      invoices: { ...invoices, rows: invoices.rows.map(invoiceSummary) },
      events: { ...events, rows: events.rows.map(event => { let path = event.path || ''; if (!path && event.url) { try { path = new URL(event.url).pathname } catch { path = '' } } return { id: event.id, name: event.custom_name || event.event_name, rawName: event.event_name, createdAt: event.event_time, path: path.split('?')[0], value: event.value ?? null } }) },
      payments: { ...payments, rows: payments.rows.map(payment => ({ id: payment.id, status: payment.status, createdAt: payment.created_at, title: payment.product?.title || payment.plan?.title || 'payment' })) },
    }
  })

export const createManualInvoice = createServerFn({ method: 'POST' })
  .validator((input: ManualInvoiceInput & { accessToken: string }) => input)
  .handler(async ({ data }) => {
    const operator = await requireOperator(data.accessToken)
    const input = validateManualInvoice(data, process.env.EMAIL_TEST_RECIPIENT)
    const invoice = await whopRequest<InvoiceRecord>('/invoices', {
      method: 'POST', headers: { 'Idempotency-Key': `roofing-manual-${operator.sub}-${input.requestId}` },
      body: JSON.stringify({ account_id: site.accountId, collection_method: 'send_invoice', customer_name: input.customerName, email_address: input.email, product: { title: `${site.company} — ${input.jobTitle}` }, plan: { currency: 'usd', initial_price: input.amount, plan_type: 'one_time', visibility: 'hidden', description: 'Template demonstration invoice. No roofing job has been booked. Do not pay this demonstration invoice.' }, line_items: [{ label: `${input.jobTitle} (template demonstration)`, unit_price: input.amount, quantity: 1 }], due_date: new Date(Date.now() + 7 * 86400000).toISOString(), save_as_draft: false }),
    })
    const summary = invoiceSummary(invoice)
    const email = await deliverInvoiceEmail(summary)
    return { invoice: summary, email }
  })

export const resendInvoiceEmail = createServerFn({ method: 'POST' })
  .validator((input: { accessToken: string; invoiceId: string }) => input)
  .handler(async ({ data }) => {
    await requireOperator(data.accessToken)
    if (!/^inv_[A-Za-z0-9]+$/.test(data.invoiceId)) throw new Error('Select a valid invoice.')
    const invoice = await whopRequest<InvoiceRecord>(`/invoices/${data.invoiceId}`)
    if ((invoice.company?.id || invoice.account_id) !== site.accountId) throw new Error('This invoice belongs to another business.')
    const summary = invoiceSummary(invoice)
    if (!summary.email || !summary.payUrl) throw new Error('This invoice does not have a payable link and customer email.')
    return deliverInvoiceEmail(summary)
  })

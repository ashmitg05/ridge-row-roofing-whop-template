export type ManualInvoiceInput = { customerName: string; email: string; jobTitle: string; amount: string; requestId: string }

export function validateManualInvoice(input: ManualInvoiceInput, testRecipient?: string) {
  const customerName = String(input.customerName || '').trim()
  const email = String(input.email || '').trim().toLowerCase()
  const jobTitle = String(input.jobTitle || '').trim()
  const amount = String(input.amount || '').trim()
  if (!customerName || customerName.length > 100 || !jobTitle || jobTitle.length > 120) throw new Error('Enter a customer name and a job description.')
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new Error('Enter a valid customer email.')
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 100000) throw new Error('Enter a balance from $0.01 to $100,000 with at most two decimals.')
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId || '')) throw new Error('Refresh this page before creating an invoice.')
  if (testRecipient && email !== testRecipient.trim().toLowerCase()) throw new Error('This template sends demo invoices only to the configured test inbox.')
  return { customerName, email, jobTitle, amount: Math.round(Number(amount) * 100) / 100, requestId: input.requestId }
}

export function safeWhopPayUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'whop.com' || url.hostname.endsWith('.whop.com')) ? url.href : null } catch { return null }
}

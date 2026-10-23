import { site } from '../site-config.ts'

export type EmailResult = { status: 'accepted' | 'not_configured' | 'restricted' | 'failed'; id?: string }

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
}

export function emailBody(title: string, paragraphs: string[], action?: { label: string; url: string }) {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f3f3ef;color:#242924;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;padding:32px 16px"><tr><td><table role="presentation" style="width:100%;max-width:580px;margin:auto;background:white;border:1px solid #dedfd8"><tr><td style="padding:24px;background:#263129;color:white;font-size:22px">${escapeHtml(site.company)} <span style="color:#e3b66b">/ Roofing</span></td></tr><tr><td style="padding:30px"><h1 style="font-size:26px;line-height:1.25">${escapeHtml(title)}</h1>${paragraphs.map(text => `<p style="font-size:16px;line-height:1.6">${escapeHtml(text)}</p>`).join('')}${action ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 20px;background:#263129;color:white;text-decoration:none">${escapeHtml(action.label)}</a></p>` : ''}<p style="font-size:13px;line-height:1.5;color:#62685e">Template demonstration. Ridge &amp; Row is a fictional roofing business. No roofing service has been booked. Payments use secure checkout.</p></td></tr></table></td></tr></table></body></html>`
}

export async function deliverEmail(message: { to: string; subject: string; title: string; paragraphs: string[]; idempotencyKey: string; action?: { label: string; url: string } }): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) return { status: 'not_configured' }
  const restricted = process.env.EMAIL_TEST_RECIPIENT?.trim().toLowerCase()
  if (restricted && message.to.trim().toLowerCase() !== restricted) return { status: 'restricted' }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': message.idempotencyKey },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || `${site.company} Demo <onboarding@resend.dev>`, to: [message.to], subject: message.subject, html: emailBody(message.title, message.paragraphs, message.action), text: `${message.title}\n\n${message.paragraphs.join('\n\n')}\n\n${message.action ? `${message.action.label}: ${message.action.url}\n\n` : ''}Template demonstration. No roofing service has been booked. Payments use secure checkout.` }),
    })
    if (!response.ok) { console.warn('Email delivery request failed', response.status); return { status: 'failed' } }
    const receipt = await response.json() as { id?: string }
    return receipt.id ? { status: 'accepted', id: receipt.id } : { status: 'failed' }
  } catch { console.warn('Email delivery request timed out'); return { status: 'failed' } }
}

export function deliverInvoiceEmail(invoice: { id: string; email: string; customerName: string; title: string; amount: number; payUrl: string | null }) {
  return deliverEmail({ to: invoice.email, subject: `${site.company} demo invoice — $${invoice.amount.toFixed(2)}`, title: 'Your demo invoice is ready.', paragraphs: [`Hello ${invoice.customerName},`, `${invoice.title}: $${invoice.amount.toFixed(2)} USD.`, `invoice reference: ${invoice.id}.`, 'This is an unpaid template demonstration, not a charge or a real amount owed. No roofing job has been booked. Please do not pay this demo invoice.'], action: invoice.payUrl ? { label: 'View demo invoice online', url: invoice.payUrl } : undefined, idempotencyKey: `roofing-invoice-${invoice.id}` })
}

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { operatorStorageKey, startOperatorSignIn } from '../estimate-oauth'
import { createManualInvoice, getOperatorData, resendInvoiceEmail } from '../server/operator'
import { site } from '../site-config'
import operatorCss from '../operator.css?url'

export const Route = createFileRoute('/operator')({
  component: Operator,
  head: () => ({ meta: [{ title: 'Operator workspace | Ridge & Row' }, { name: 'robots', content: 'noindex, nofollow' }], links: [{ rel: 'stylesheet', href: operatorCss }] }),
})

type Workspace = Awaited<ReturnType<typeof getOperatorData>>
type Receipt = Awaited<ReturnType<typeof createManualInvoice>>
type Tab = 'estimates' | 'invoices' | 'events'
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
const time = (value: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : '—'
const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.'
const emailLabel = (status: string) => ({ accepted: 'Email accepted by Resend', restricted: 'Email restricted to the test inbox', not_configured: 'Email provider is not configured', failed: 'Invoice saved; email delivery request failed' }[status] || status)

function Operator() {
  const [token, setToken] = useState('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tab, setTab] = useState<Tab>('estimates')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [requestId, setRequestId] = useState('')

  async function refresh(accessToken = token) {
    setLoading(true); setError('')
    try { setWorkspace(await getOperatorData({ data: { accessToken } })) }
    catch (caught) { setError(message(caught)) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    setRequestId(crypto.randomUUID())
    const saved = sessionStorage.getItem(operatorStorageKey) || ''
    setToken(saved)
    if (saved) void refresh(saved)
    else setLoading(false)
  }, [])

  async function signIn() {
    setError(''); setBusy(true)
    try { await startOperatorSignIn() } catch (caught) { setError(message(caught)); setBusy(false) }
  }

  function signOut() {
    sessionStorage.removeItem(operatorStorageKey); setToken(''); setWorkspace(null); setReceipt(null); setError(''); setNotice('')
  }

  async function invoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await createManualInvoice({ data: { accessToken: token, requestId, customerName: String(values.get('customerName') || ''), email: String(values.get('email') || ''), jobTitle: String(values.get('jobTitle') || ''), amount: String(values.get('amount') || '') } })
      setReceipt(result); setRequestId(crypto.randomUUID()); await refresh()
    } catch (caught) { setError(message(caught)) }
    finally { setBusy(false) }
  }

  async function retryEmail(invoiceId: string) {
    setBusy(true); setError('')
    try { const result = await resendInvoiceEmail({ data: { accessToken: token, invoiceId } }); setNotice(emailLabel(result.status)) }
    catch (caught) { setError(message(caught)) }
    finally { setBusy(false) }
  }

  return <main className="operator-page" data-ui>
    <aside className="operator-sidebar"><a className="operator-brand" href="/"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M2 20 11 4l8 16M12 20 21 4l9 16" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg><span>Ridge & Row<small>Operator workspace</small></span></a><p className="operator-scope">Roofing demo business</p><nav aria-label="Operator navigation">{(['estimates', 'invoices', 'events'] as const).map(name => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)} aria-current={tab === name ? 'page' : undefined}>{name === 'estimates' ? 'Estimate requests' : name === 'invoices' ? 'Final invoices' : 'Pixel events'}</button>)}</nav><a className="operator-back" href="/">View the live website ↗</a><p className="operator-footnote">estimate requests · invoices<br />Website tracking · Resend email</p></aside>
    <div className="operator-work"><header className="operator-topbar"><span>{site.company} / Roofing</span><span>{workspace?.operator.email || 'Owner access'}</span>{workspace && <button onClick={signOut}>Sign out</button>}</header>
      <div className="operator-sheet">
        {!workspace ? <div className="operator-login"><p className="operator-eyebrow">Private operator workspace</p><h1>Estimates to final invoices.</h1><p>Review real estimate requests, inspect pixel events, and create manual final-balance invoices. Sign in with the account configured to operate this website.</p>{error && <p role="alert" className="operator-error">{error}</p>}<button className="operator-primary" onClick={signIn} disabled={loading || busy}>{loading ? 'Checking your account…' : busy ? 'Opening sign-in…' : 'Sign in'}</button><p className="operator-muted">Customer records and invoice actions are available only after the server verifies operator access.</p></div> : <>
          <div className="operator-title"><div><p className="operator-eyebrow">{tab === 'estimates' ? 'Estimate requests' : tab === 'invoices' ? 'Invoices' : 'Events'}</p><h1>{tab === 'estimates' ? 'Estimate requests' : tab === 'invoices' ? 'Final invoices' : 'Pixel events'}</h1><p>{tab === 'estimates' ? 'Requests saved to this business, with their contact and roof details.' : tab === 'invoices' ? 'Create a manual invoice and send its payment link by email.' : 'Recorded events from the live website over the last 30 days.'}</p></div><button className="operator-secondary" onClick={() => void refresh()} disabled={loading || busy}>{loading ? 'Refreshing…' : 'Refresh records'}</button></div>
          <p className="operator-freshness">Live account data · Updated {time(workspace.fetchedAt)}</p>
          {error && <p role="alert" className="operator-error">{error}</p>}{notice && <p role="status" className="operator-notice">{notice}</p>}
          <div className="operator-connection"><span>Email delivery: <strong>{workspace.email.configured ? 'Resend configured' : 'Not configured'}</strong></span>{workspace.email.testRecipient && <span>Demo inbox: {workspace.email.testRecipient}</span>}</div>
          {tab === 'estimates' && <><FeedError error={workspace.leads.error} /><div className="operator-list-heading"><h2>Latest {workspace.leads.rows.length} requests</h2><span>{workspace.leads.more ? 'Showing the first 50; more in the payment provider.' : 'Account records'}</span></div>{!workspace.leads.error && !workspace.leads.rows.length && <Empty>No estimates yet. Submit the website’s estimate form to create a real estimate request.</Empty>}<div className="operator-leads">{workspace.leads.rows.map(lead => <article className="operator-lead" key={lead.id}><div><h3>{lead.name}</h3><p>{lead.service || 'Roofing estimate'} {lead.zip && `· ZIP ${lead.zip}`}</p><p>{lead.message || 'No additional project details provided.'}</p></div><div className="operator-contact"><a href={`mailto:${lead.email}`}>{lead.email || 'No email available'}</a><span>{lead.phone || 'No phone provided'}</span><time>{time(lead.createdAt)}</time><code>{lead.id}</code></div></article>)}</div></>}
          {tab === 'invoices' && <><div className="operator-invoice-grid"><section className="operator-invoice-intro"><h2>Bill the agreed balance.</h2><p>This manual path creates an open invoice. It works independently of the paid-deposit reconciliation flow.</p><p>The customer chooses when to pay online. No stored card is charged by this action.</p>{workspace.email.testRecipient && <p className="operator-demo-note">Demo invoices are clearly labeled and restricted to your test inbox. They do not represent an actual amount owed.</p>}</section><form className="operator-invoice-form" onSubmit={invoice}><label>Customer name<input name="customerName" required maxLength={100} defaultValue="Template Demo Customer" /></label><label>Customer email<input type="email" name="email" required maxLength={254} defaultValue={workspace.email.testRecipient || workspace.operator.email} /></label><label>Job description<input name="jobTitle" required maxLength={120} defaultValue="Roof replacement — final balance" /></label><label>Remaining balance (USD)<input name="amount" inputMode="decimal" type="number" min="0.01" max="100000" step="0.01" required defaultValue="1250.00" /></label><label className="operator-confirm"><input type="checkbox" required />I confirm this is a demonstration invoice sent to the test inbox.</label><button className="operator-primary" disabled={busy || loading}>{busy ? 'Creating invoice…' : 'Create & email demo invoice'}</button><p className="operator-muted">Creates a real, unpaid invoice and sends its link. No payment is made.</p></form></div>
            {receipt && <div className="operator-receipt" role="status"><h2>Invoice created online.</h2><dl><dt>Reference</dt><dd><code>{receipt.invoice.id}</code></dd><dt>Balance</dt><dd>{money(receipt.invoice.amount)}</dd><dt>Status</dt><dd>{receipt.invoice.status}</dd><dt>Collection</dt><dd>Manual payment</dd><dt>Email</dt><dd>{emailLabel(receipt.email.status)}</dd></dl>{receipt.invoice.payUrl && <a className="operator-secondary" href={receipt.invoice.payUrl} target="_blank" rel="noopener noreferrer">View invoice ↗</a>}</div>}
            <FeedError error={workspace.invoices.error} /><h2 className="operator-section-title">Latest invoices</h2>{!workspace.invoices.error && !workspace.invoices.rows.length && <Empty>No invoices yet. Create a demonstration invoice above.</Empty>}<div className="operator-table-wrap"><table><thead><tr><th>Invoice / customer</th><th>Status</th><th>Balance</th><th>Created</th><th>Actions</th></tr></thead><tbody>{workspace.invoices.rows.map(item => <tr key={item.id}><td><strong>{item.title}</strong><span>{item.email}</span><code>{item.id}</code></td><td><Status value={item.status} /></td><td className="operator-number">{money(item.amount)}</td><td>{time(item.createdAt)}</td><td className="operator-actions">{item.payUrl && <a href={item.payUrl} target="_blank" rel="noopener noreferrer">View online ↗</a>}<button onClick={() => void retryEmail(item.id)} disabled={busy}>Send email</button></td></tr>)}</tbody></table></div>
            <FeedError error={workspace.payments.error} /><h2 className="operator-section-title">Recent payment results</h2><p className="operator-muted">These are actual payment statuses. A failed attempt is not a completed payment.</p>{!workspace.payments.error && !workspace.payments.rows.length && <Empty>No payments recorded for this business yet.</Empty>}<div className="operator-payment-list">{workspace.payments.rows.map(item => <div key={item.id}><strong>{item.title}</strong><code>{item.id}</code><Status value={item.status} /></div>)}</div>
          </>}
          {tab === 'events' && <><FeedError error={workspace.events.error} /><div className="operator-event-summary">{['estimate_requested', 'service_viewed', 'deposit_started'].map(name => <div key={name}><span>{name}</span><strong>{workspace.events.rows.filter(item => item.name === name || item.rawName.endsWith(`:${name}`)).length}</strong><small>In the loaded event feed</small></div>)}</div><p className="operator-muted">The system can take a minute to ingest new events. Counts reflect up to 200 returned events, not lifetime totals.{workspace.events.more ? ' More events are available in the payment provider.' : ''}</p>{!workspace.events.error && !workspace.events.rows.length && <Empty>No events returned for this time range. Visit the live site, interact with a service, or submit an estimate, then refresh.</Empty>}<div className="operator-table-wrap"><table><thead><tr><th>Event</th><th>Page</th><th>Recorded</th><th>Reference</th></tr></thead><tbody>{workspace.events.rows.map(item => <tr key={item.id}><td><strong>{item.name}</strong><span>{item.rawName}</span></td><td>{item.path || '—'}</td><td>{time(item.createdAt)}</td><td><code>{item.id}</code></td></tr>)}</tbody></table></div></>}
        </>}
      </div>
    </div>
  </main>
}

function FeedError({ error }: { error: string | null }) { return error ? <p className="operator-error" role="alert">{error} Other feeds remain available.</p> : null }
function Empty({ children }: { children: React.ReactNode }) { return <p className="operator-empty">{children}</p> }
function Status({ value }: { value: string }) { return <span className={`operator-status ${value === 'failed' ? 'failed' : value === 'paid' || value === 'succeeded' ? 'paid' : ''}`}>{value.replaceAll('_', ' ')}</span> }

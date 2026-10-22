import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BrandingElement, EmailElement, PaymentElement, Payments, WhopElements, usePayments, useWhop } from '@whop/elements-react'
import { loadWhop } from '@whop/elements'
import { createCardSetupIntent, verifyCardSetupIntent, verifyServicePayment } from '../server/payments'
import { site, type CheckoutItem } from '../site-config'
import '../checkout.css'

export const Route = createFileRoute('/checkout/return')({ component: CheckoutReturn })

const elements = loadWhop()

function CheckoutReturn() {
  const [params, setParams] = useState(() => new URLSearchParams())
  useEffect(() => { setParams(new URLSearchParams(window.location.search)) }, [])
  const item = params.get('item')
  const paymentId = params.get('payment')
  const status = params.get('status')
  const [verified, setVerified] = useState(false)
  const [checking, setChecking] = useState(true)
  const saving = params.get('mode') === 'save'
  const setupId = params.get('setup') || params.get('setup_intent_id')
  const depositPaymentId = params.get('deposit_payment')
  const [saved, setSaved] = useState(false)
  const [checkingSave, setCheckingSave] = useState(true)

  useEffect(() => {
    if (saving) return
    if (status !== 'succeeded') return
    if (!item || !['inspection', 'deposit', 'repair'].includes(item) || !paymentId) { setChecking(false); return }
    setChecking(true)
    verifyServicePayment({ data: { paymentId, item: item as CheckoutItem } }).then((result) => setVerified(result.paid)).catch(() => setVerified(false)).finally(() => setChecking(false))
  }, [item, status, paymentId, saving])

  useEffect(() => {
    if (!saving) return
    if (!setupId || !depositPaymentId) { setCheckingSave(false); return }
    verifyCardSetupIntent({ data: { setupId, depositPaymentId } }).then((result) => setSaved(result.saved)).catch(() => setSaved(false)).finally(() => setCheckingSave(false))
  }, [saving, setupId, depositPaymentId])

  if (saving) return <main className="checkout-shell checkout-result"><a className="checkout-back" href="/">← Ridge & Row Roofing</a><p className="micro">CARD ON FILE</p><h1>{checkingSave ? 'Checking the saved method.' : saved ? 'Payment method saved.' : 'Payment method not confirmed.'}</h1><p>{checkingSave ? 'Whop is confirming the setup intent.' : saved ? 'Whop saved an authorized method for a later final-balance invoice. Nothing was charged by this step.' : 'Whop has not confirmed a saved method. The final balance will need a manual payment option.'}</p><a className="button button-dark" href="/">Back to site</a></main>

  return <main className="checkout-shell checkout-result">
    <a className="checkout-back" href="/">← Ridge & Row Roofing</a>
    {status === 'succeeded' ? <><p className="micro">WHOP PAYMENT</p><h1>{checking ? 'Checking your payment.' : verified ? 'Payment confirmed.' : 'Payment not confirmed.'}</h1><p>{checking ? 'We are checking this charge with Whop.' : verified ? 'Whop confirms this payment is paid. Your receipt is on its way.' : 'Whop has not confirmed a paid charge for this service. Check your receipt or contact the business before trying again.'}</p>{paymentId && <p className="payment-reference">Payment reference: {paymentId}</p>}</> : status === 'failed' || status === 'canceled' ? <><p className="micro">PAYMENT NOT COMPLETED</p><h1>Let’s try that again.</h1><p>Whop did not confirm a charge. You can return to checkout and choose another method.</p></> : <><p className="micro">PAYMENT PROCESSING</p><h1>Whop is checking your payment.</h1><p>You will receive a confirmation when the payment is complete.</p></>}
    {item === 'deposit' && status === 'succeeded' && <section className="save-card">
      <p className="micro">OPTIONAL NEXT STEP</p><h2>Authorize a method for the final balance</h2>
      {checking ? <p>Checking the deposit payment…</p> : verified && paymentId ? <><p>Whop can save your payment method for a later invoice. No additional charge is made now.</p><WhopElements elements={elements}><Payments accountId={site.accountId} mode="setup" currency="usd" returnUrl={`${site.baseUrl}/checkout/return?mode=save&deposit_payment=${paymentId}`}><CardSaveForm paymentId={paymentId} /></Payments></WhopElements></> : <p>The save option appears after Whop confirms a paid deposit.</p>}
    </section>}
    <a className="button button-dark" href={item && ['inspection', 'deposit', 'repair'].includes(item) ? `/checkout/${item}` : '/'}>{status === 'failed' || status === 'canceled' ? 'Back to checkout' : 'Back to site'}</a>
  </main>
}

function CardSaveForm({ paymentId }: { paymentId: string }) {
  const payments = usePayments()
  const whop = useWhop()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    if (!payments || !whop || !ready || busy) return
    setBusy(true)
    setMessage('')
    try {
      const { confirmationToken } = await payments.createConfirmationToken({})
      const setup = await createCardSetupIntent({ data: { confirmationToken, paymentId } })
      if (setup.status === 'succeeded') { setMessage('Whop saved the method for a later invoice.'); return }
      if (!setup.client_secret) throw new Error('Whop could not finish saving the method.')
      const result = await whop.payments.handleNextAction({ clientSecret: setup.client_secret })
      if (result.redirected) return
      setMessage(result.status === 'succeeded' ? 'Whop saved the method for a later invoice.' : result.status === 'processing' ? 'Whop is still confirming the saved method.' : result.lastPaymentError?.message || 'The method was not saved. Please try again.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The method could not be saved.') }
    finally { setBusy(false) }
  }

  return <div className="save-card-elements"><EmailElement /><PaymentElement onChange={(event) => setReady(event.complete)} /><BrandingElement /><button className="button button-gold" type="button" onClick={save} disabled={!ready || busy}>{busy ? 'Saving…' : 'Save payment method with Whop'}</button>{message && <p role="status">{message}</p>}</div>
}

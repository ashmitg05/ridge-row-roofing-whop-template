import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BrandingElement, Checkout, EmailElement, ExpressCheckoutElement, PaymentElement, Payments, WhopElements, usePayments, useWhop } from '@whop/elements-react'
import { loadWhop } from '@whop/elements'
import { checkoutItems, site, type CheckoutItem } from '../site-config'
import { createServicePayment } from '../server/payments'
import '../checkout.css'

export const Route = createFileRoute('/checkout/$item')({ component: CheckoutPage })

const elements = loadWhop()

function CheckoutPage() {
  const { item } = Route.useParams()
  const key = item as CheckoutItem
  const offer = checkoutItems[key]
  if (!offer) return <main className="checkout-shell"><h1>Service not found</h1><a href="/">Back to the site</a></main>

  const returnUrl = `${site.baseUrl}/checkout/return?item=${key}`
  return <main className="checkout-shell">
    <a className="checkout-back" href="/">← Ridge & Row Roofing</a>
    <div className="checkout-heading"><div><p className="micro">SECURE CHECKOUT</p><h1>{offer.title}</h1><p>{offer.description}</p></div><strong>${offer.price}</strong></div>
    <p className="checkout-notice">Template demonstration for a fictional roofing business. This is a live payment form. Completing checkout may charge your payment method.</p>
    <div className="checkout-layout">
      <section className="checkout-form" aria-label="payment form">
        <WhopElements elements={elements}>
          <Checkout
            key={`${key}-express`}
            plan={site.plans[key]}
            metadata={{ template: 'ridge_row_roofing', service: key }}
            returnUrl={returnUrl}
            onComplete={(completion) => {
              if (completion.result === 'payment') {
                window.location.assign(`/checkout/return?item=${key}&status=succeeded&payment=${completion.paymentId}`)
              }
            }}
          >
            <ExpressCheckoutElement layout="vertical" wallets={['apple_pay', 'google_pay']} />
          </Checkout>
          <Payments
            key={`${key}-payment`}
            accountId={site.accountId}
            plan={site.plans[key]}
            returnUrl={returnUrl}
          >
            <ServicePaymentForm item={key} />
          </Payments>
        </WhopElements>
      </section>
      <aside className="checkout-aside"><p className="micro">WHAT HAPPENS NEXT</p><h2>{key === 'deposit' ? 'Deposit first. Final balance later.' : 'A clear starting point.'}</h2><p>{key === 'deposit' ? 'Once the deposit is confirmed, you can authorize a payment method for the remaining balance. The final invoice is created only after the job is complete.' : 'Our payment provider handles the payment and sends a receipt. This template does not schedule a real roofing visit.'}</p><p>Payment choices, including financing, appear only when the payment provider approves the merchant and the buyer, device, and region qualify.</p><div className="checkout-aside-line"><span>Provided by</span><strong>Secure checkout</strong></div></aside>
    </div>
  </main>
}

function ServicePaymentForm({ item }: { item: CheckoutItem }) {
  const payments = usePayments()
  const whop = useWhop()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pay() {
    if (!payments || !whop || !ready || busy) return
    setBusy(true)
    setError('')
    try {
      const { confirmationToken } = await payments.createConfirmationToken({})
      const payment = await createServicePayment({ data: { confirmationToken, item } })
      if (payment.status === 'paid') { window.location.assign(`/checkout/return?item=${item}&status=succeeded&payment=${payment.id}`); return }
      if (!payment.client_secret) throw new Error('The payment provider could not finish this payment.')
      const result = await whop.payments.handleNextAction({ clientSecret: payment.client_secret })
      if (result.redirected) return
      if (result.status === 'succeeded' || result.status === 'processing') {
        window.location.assign(`/checkout/return?item=${item}&status=${result.status}&payment=${payment.id}`)
        return
      }
      setError(result.lastPaymentError?.message || 'The payment was not completed. Please try again.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The payment provider could not complete the payment.') }
    finally { setBusy(false) }
  }

  return <div className="payment-elements"><EmailElement /><PaymentElement onChange={(event) => setReady(event.complete)} /><BrandingElement /><button className="button button-gold" type="button" onClick={pay} disabled={!ready || busy}>{busy ? 'Processing…' : `Pay $${checkoutItems[item].price} securely`}</button>{error && <p className="payment-error" role="alert">{error}</p>}</div>
}

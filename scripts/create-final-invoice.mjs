import { WhopClient } from '@whop/sdk'
import { site } from '../src/site-config.ts'

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=')
  return [key, value.join('=') || true]
}))

if (args.help || !args['deposit-payment'] || !args.total || !process.env.WHOP_API_KEY) {
  console.log('Usage: WHOP_API_KEY=<server key> node scripts/create-final-invoice.mjs --deposit-payment=pay_... --total=2500 --collection=manual|automatic [--setup-intent=sint_...] [--execute]')
  console.log('Without --execute, creates a draft only. Automatic collection requires a succeeded setup intent from that buyer.')
  process.exit(args.help ? 0 : 1)
}

const total = Number(args.total)
if (!Number.isFinite(total) || total <= site.prices.deposit || Math.round(total * 100) !== total * 100) throw new Error('The total must be a dollar amount above the $500 deposit, with at most two decimals.')
const balance = Math.round((total - site.prices.deposit) * 100) / 100
const collection = args.collection || 'manual'
if (!['manual', 'automatic'].includes(collection)) throw new Error('Collection must be manual or automatic.')
if (collection === 'automatic' && !args['setup-intent']) throw new Error('Automatic collection requires --setup-intent.')

const whop = new WhopClient({ token: process.env.WHOP_API_KEY })
const deposit = await whop.payments.retrieve({ id: String(args['deposit-payment']) })
const depositPlan = deposit.line_items?.some((line) => line.plan_id === site.plans.deposit) || deposit.plan_id === site.plans.deposit
if (deposit.account_id !== site.accountId || deposit.status !== 'paid' || !depositPlan) throw new Error('The payment is not a paid Ridge & Row project deposit.')
if (!deposit.member_id || !deposit.customer_email) throw new Error('The deposit has no member and email for invoicing.')

let paymentMethodId
if (collection === 'automatic') {
  const setup = await whop.setupIntents.retrieve({ id: String(args['setup-intent']) })
  if (setup.status !== 'succeeded' || setup.metadata?.deposit_payment_id !== deposit.id || setup.member_id !== deposit.member_id || !setup.payment_method_id) {
    throw new Error('The setup intent is not a confirmed method for this deposit buyer.')
  }
  paymentMethodId = setup.payment_method_id
}

const invoice = await whop.invoices.create({
  account_id: site.accountId,
  collection_method: collection === 'automatic' ? 'charge_automatically' : 'send_invoice',
  member_id: deposit.member_id,
  email_address: deposit.customer_email,
  payment_method_id: paymentMethodId,
  product: { title: 'Roofing project final balance' },
  plan: { currency: 'usd', initial_price: balance, plan_type: 'one_time', description: `Final balance for project after $${site.prices.deposit} deposit ${deposit.id}` },
  line_items: [{ label: 'Roofing project balance', unit_price: balance, quantity: 1 }],
  save_as_draft: args.execute !== true,
})

console.log(JSON.stringify({ invoice_id: invoice.id, status: invoice.status, collection_method: invoice.collection_method, final_balance: balance, pay_online_url: invoice.pay_online_url || null }, null, 2))

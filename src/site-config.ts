export const site = {
  accountId: 'biz_pdwUVTG8dSi5b7',
  appId: 'app_cEAPbWVzlL1op6',
  baseUrl: 'https://ridge-row-roofing-demo.whop.site',
  company: 'Ridge & Row',
  descriptor: 'ROOFING',
  email: 'hello@example.com',
  phoneDisplay: '(512) 555-0148',
  phoneHref: 'tel:+15125550148',
  city: 'Austin, TX',
  serviceArea: ['Austin', 'Round Rock', 'Cedar Park', 'Pflugerville', 'West Lake Hills'],
  prices: { inspection: 149, deposit: 500, repair: 425 },
  plans: { inspection: 'plan_IJgveeMOWasYp', deposit: 'plan_oIRf6rgEaAf7N', repair: 'plan_kwggcrwyAkKwK' },
  checkoutUrls: {
    inspection: 'https://whop.com/checkout/plan_IJgveeMOWasYp',
    deposit: 'https://whop.com/checkout/plan_oIRf6rgEaAf7N',
    repair: 'https://whop.com/checkout/plan_kwggcrwyAkKwK',
  },
} as const

export type CheckoutItem = 'inspection' | 'deposit' | 'repair'

export const checkoutItems: Record<CheckoutItem, { title: string; description: string; price: number }> = {
  inspection: { title: 'Roof inspection', description: 'A documented roof assessment and a written next-step recommendation.', price: site.prices.inspection },
  deposit: { title: 'Project deposit', description: 'A sample booking deposit shown as part of the project journey.', price: site.prices.deposit },
  repair: { title: 'Minor roof repair', description: 'A flat-rate example for a scoped, localized shingle repair.', price: site.prices.repair },
}

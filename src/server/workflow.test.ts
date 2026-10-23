import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateManualInvoice, safeWhopPayUrl } from './invoice-input.ts'
import { deliverEmail, emailBody } from './email.ts'
import { requireOperator } from './whop-api.ts'

const valid = { customerName: 'Demo Customer', email: 'owner@example.test', jobTitle: 'Roof replacement final balance', amount: '1250.25', requestId: '3b31fcf1-d88d-41bc-9f19-f1aa5f922369' }

test('manual invoices accept exact cents and reject unsafe balances and recipients', () => {
  assert.equal(validateManualInvoice(valid, valid.email).amount, 1250.25)
  assert.equal(validateManualInvoice({ ...valid, amount: '0.01' }).amount, 0.01)
  for (const amount of ['-1', '0', '1.001', '1e3', 'NaN', '100000.01', 'Infinity', '']) assert.throws(() => validateManualInvoice({ ...valid, amount }))
  assert.throws(() => validateManualInvoice({ ...valid, email: 'other@example.test' }, valid.email))
  assert.throws(() => validateManualInvoice({ ...valid, requestId: '' }))
})

test('invoice payment links must lead to HTTPS Whop hosts', () => {
  assert.equal(safeWhopPayUrl('https://whop.com/checkout/plan_demo'), 'https://whop.com/checkout/plan_demo')
  for (const url of ['javascript:alert(1)', 'http://whop.com/x', 'https://whop.com.evil.test/x', 'https://evil.test', null]) assert.equal(safeWhopPayUrl(url), null)
})

test('email HTML escapes submitted names and descriptions', () => {
  const html = emailBody('<script>alert(1)</script>', ['<img src=x onerror=alert(1)>', 'A & B'])
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;img'))
  assert.ok(html.includes('A &amp; B'))
})

test('email failure does not throw, recipients are restricted, and retries use the supplied idempotency key', async () => {
  const oldFetch = globalThis.fetch
  const oldKey = process.env.RESEND_API_KEY, oldRecipient = process.env.EMAIL_TEST_RECIPIENT
  const message = { to: valid.email, subject: 'Demo', title: 'Demo', paragraphs: ['Saved request'], idempotencyKey: 'demo-request-123' }
  try {
    delete process.env.RESEND_API_KEY
    assert.equal((await deliverEmail(message)).status, 'not_configured')
    process.env.RESEND_API_KEY = 'test-key-not-a-real-credential'; process.env.EMAIL_TEST_RECIPIENT = valid.email
    globalThis.fetch = async () => { throw new Error('A restricted recipient must not reach Resend') }
    assert.equal((await deliverEmail({ ...message, to: 'other@example.test' })).status, 'restricted')
    globalThis.fetch = async () => new Response('{}', { status: 503 })
    assert.equal((await deliverEmail(message)).status, 'failed')
    globalThis.fetch = async (_url, options) => {
      assert.equal(new Headers(options?.headers).get('Idempotency-Key'), 'demo-request-123')
      assert.deepEqual(JSON.parse(String(options?.body)).to, [valid.email])
      return Response.json({ id: 'email_demo' })
    }
    assert.deepEqual(await deliverEmail(message), { status: 'accepted', id: 'email_demo' })
  } finally {
    globalThis.fetch = oldFetch
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey
    if (oldRecipient === undefined) delete process.env.EMAIL_TEST_RECIPIENT; else process.env.EMAIL_TEST_RECIPIENT = oldRecipient
  }
})

test('operator API fails closed for missing allowlist, foreign users, and expired tokens', async () => {
  const oldFetch = globalThis.fetch, oldAllowed = process.env.WHOP_OPERATOR_USER_IDS
  try {
    globalThis.fetch = async () => Response.json({ sub: 'user_testoperator' })
    delete process.env.WHOP_OPERATOR_USER_IDS
    await assert.rejects(requireOperator('test-access-token'), /operator access/)
    process.env.WHOP_OPERATOR_USER_IDS = 'user_someoneelse'
    await assert.rejects(requireOperator('test-access-token'), /operator access/)
    process.env.WHOP_OPERATOR_USER_IDS = 'user_testoperator'
    assert.equal((await requireOperator('test-access-token')).sub, 'user_testoperator')
    globalThis.fetch = async () => new Response('{}', { status: 401 })
    await assert.rejects(requireOperator('test-access-token'), /expired/)
    await assert.rejects(requireOperator(''), /sign in/)
  } finally {
    globalThis.fetch = oldFetch
    if (oldAllowed === undefined) delete process.env.WHOP_OPERATOR_USER_IDS; else process.env.WHOP_OPERATOR_USER_IDS = oldAllowed
  }
})

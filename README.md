# Ridge & Row Roofing — Whop Website template

Live demo: https://ridge-row-roofing-demo.whop.site

Original, responsive roofing site for Whop Websites. Ridge & Row is fictional; the reviews section is an explicit placeholder, not a fabricated testimonial. It includes repair, replacement, inspection, service area, financing context, pricing, trust, and an estimate form.

## What works

- Whop Websites deployment on `whop.site`.
- Three hidden, one-time Whop plans in the demo business: inspection ($149), project deposit ($500), and minor repair ($425). Their canonical `purchase_url` checkout links and plan IDs live in `src/site-config.ts`.
- Estimate form uses Whop OAuth with PKCE to identify the visitor, then creates a Whop Lead on the demo business. Whop sign-in is required by the Leads API.
- Custom `whop.track` events: `service_viewed`, `deposit_started`, and `estimate_requested`. The last fires only after a Lead is created.
- The three service buttons open embedded **EmailElement, PaymentElement, and BrandingElement** forms. The server sends each one-time confirmation token to Whop's Payments API. **ExpressCheckoutElement** mounts Apple Pay and Google Pay when the device, domain, and merchant support them. The checkout is live and may charge the buyer. The roofing brand remains a fictional template example.
- Hosted payment requests use Whop Websites' authenticated outbound API proxy. No payment API key is stored in the source or app secrets; local `whop apps dev` supplies development authentication.
- After a confirmed deposit, the return page offers a separate save-method step with **EmailElement, PaymentElement, and BrandingElement**. The server verifies the paid deposit and creates a Whop setup intent from the buyer's confirmation token. The browser handles any remaining bank or 3D Secure step.
- `scripts/create-final-invoice.mjs` creates a Whop final-balance invoice after checking a paid deposit. It creates a draft by default. `--collection=automatic` requires a succeeded setup intent for the same buyer. `--execute` sends or charges the invoice, so use it only for an actual finished job.

## Run and deploy

```bash
npm install
npm run generate-routes
npm run typecheck
npm run dev
```

To deploy, authenticate the Whop CLI, initialize a new Website app with `whop apps init`, then run `whop apps deploy`. The deployment-specific `whop.app.json` is omitted from the distributed source archive so a new template user does not overwrite this demo. For local Leads API calls, run `whop apps dev` from an authenticated CLI session; the hosted site uses Whop's injected API origin and account ID.

## Adapt for a real contractor

1. Change company name, prices, plan IDs, service area, business ID, and `baseUrl` in `src/site-config.ts`.
2. Replace sample imagery, the proof placeholder, copy, and contact details with verified business material.
3. Create your own Whop Website app and set `site.appId` to its app ID.
4. Register the app's `/oauth/callback` URL in Whop. It is derived from `site.baseUrl`. Enable the `openid`, `profile`, and `email` OAuth scopes.
5. Create three one-time plans in the new Whop business and replace the sample plan IDs and checkout URLs. Whop returns each plan's canonical `purchase_url` through its Plans API or dashboard.
6. For a finished job, set `WHOP_API_KEY` in the operator's shell and run `node scripts/create-final-invoice.mjs --deposit-payment=pay_... --total=2500 --collection=manual` to create a draft final-balance invoice. Use `--collection=automatic --setup-intent=sint_...` only when the buyer authorized a saved method. Add `--execute` only when it is time to collect the balance.

## Verification limits

The embedded checkout and saved-method form are real Whop Elements. Whop's docs say Elements sandbox is not generally available, so this repository does **not** claim a completed sandbox checkout or saved test card. Wallets and financing show only when Whop offers them to that buyer. A manual demo invoice was created and emailed; it remains open, and no payment was made. No stored-card payment occurred. The requested successful sandbox checkout and complete submission recording remain unverified.

The source lives in `src/`; design assets are in `public/images/`. `src/server/estimate.ts` is the server-side Lead creation handler. No API key is committed. The Whop OAuth access token is held only for the submission, and the sign-in state is stored temporarily in session storage.

## Private operator workspace and email

Open `/operator` and sign in with an allowlisted Whop user. Server-side checks protect every data request and invoice action. Configure encrypted Whop secrets `WHOP_OPERATOR_USER_IDS` (comma-separated user IDs), `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_TEST_RECIPIENT`. Never put credentials in client code.

The workspace lists real account Leads, manual invoices, recent payment results, and tracked events. A manual final-balance invoice can be created independently of a paid deposit. It uses `send_invoice`, a due date seven days ahead, and does not charge a stored card. Demonstration invoices are restricted to the configured test inbox and clearly state that no actual debt exists.

Estimate confirmations require the submitted email to match the authenticated Whop identity. Email failures do not erase saved Leads or created invoices. Resend acceptance is distinguished from actual delivery. The default Resend test sender only supports the account owner's inbox; verify a sending domain before using real customer addresses.

`npm test` checks monetary validation, recipient restrictions, escaping, link safety, email failure/idempotency handling, and operator authorization boundaries.

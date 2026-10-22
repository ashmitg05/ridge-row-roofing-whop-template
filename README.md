# Ridge & Row Roofing — Whop Website template

Live demo: https://ridge-row-roofing-demo.whop.site

Original, responsive roofing site for Whop Websites. The brand and testimonials are fictional and labeled as samples. It includes repair, replacement, inspection, service area, financing context, pricing, trust, and an estimate form.

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
2. Replace sample imagery, review, copy, and contact details with verified business material.
3. Create your own Whop Website app and set `site.appId` to its app ID.
4. Register the app's `/oauth/callback` URL in Whop. It is derived from `site.baseUrl`. Enable the `openid`, `profile`, and `email` OAuth scopes.
5. Create three one-time plans in the new Whop business and replace the sample plan IDs and checkout URLs. Whop returns each plan's canonical `purchase_url` through its Plans API or dashboard.
6. For a finished job, set `WHOP_API_KEY` in the operator's shell and run `node scripts/create-final-invoice.mjs --deposit-payment=pay_... --total=2500 --collection=manual` to create a draft final-balance invoice. Use `--collection=automatic --setup-intent=sint_...` only when the buyer authorized a saved method. Add `--execute` only when it is time to collect the balance.

## Verification limits

The embedded checkout and saved-method form are real Whop Elements. Whop's docs say Elements sandbox is not generally available, so this repository does **not** claim a completed sandbox checkout or saved test card. Wallets and financing show only when Whop offers them to that buyer. No real payment or final invoice has been created for the fictional demo business. A 3–5 minute submission recording with a completed sandbox payment and invoice cannot honestly be produced until Whop enables a compatible test flow and a consenting test buyer completes it.

The source lives in `src/`; design assets are in `public/images/`. `src/server/estimate.ts` is the server-side Lead creation handler. No API key is committed. The Whop OAuth access token is held only for the submission, and the sign-in state is stored temporarily in session storage.

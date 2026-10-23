import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { checkoutItems, site, type CheckoutItem } from '../site-config'
import { startEstimateSignIn } from '../estimate-oauth'
import { track } from '../tracking'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [selected, setSelected] = useState<CheckoutItem>('inspection')
  const [menuOpen, setMenuOpen] = useState(false)
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const sections = [...document.querySelectorAll<HTMLElement>('main > section:not(.hero)')]
    document.documentElement.classList.add('motion-ready')
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('motion-visible')
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    sections.forEach((section) => observer.observe(section))
    return () => {
      observer.disconnect()
      document.documentElement.classList.remove('motion-ready')
    }
  }, [])

  function selectService(item: CheckoutItem) {
    setSelected(item)
    track('service_viewed', { service: item })
  }

  async function onEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setFormStatus('loading')
    setFormError('')
    try {
      await startEstimateSignIn({
        name: String(values.get('name') || ''),
        email: String(values.get('email') || ''),
        phone: String(values.get('phone') || ''),
        zip: String(values.get('zip') || ''),
        service: String(values.get('service') || ''),
        message: String(values.get('message') || ''),
        website: String(values.get('website') || ''),
      })
    } catch (error) {
      setFormStatus('error')
      setFormError(error instanceof Error ? error.message : 'The request could not be sent. Please try again.')
    }
  }

  return (
    <>
      <div className="demo-strip">A fictional roofing-company template. Live checkout may charge.</div>
      <header className="site-header wrap">
        <a className="brand" href="#top" aria-label="Ridge and Row home"><RoofMark /><span>{site.company}<small>{site.descriptor}</small></span></a>
        <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-menu" onClick={() => setMenuOpen(!menuOpen)}><span className="menu-icon" aria-hidden="true"><i /><i /></span>{menuOpen ? 'Close' : 'Menu'}</button>
        <nav id="main-menu" className={menuOpen ? 'open' : ''} aria-label="Main navigation"><a href="#services" onClick={() => setMenuOpen(false)}>Services</a><a href="#process" onClick={() => setMenuOpen(false)}>How it works</a><a href="#area" onClick={() => setMenuOpen(false)}>Service area</a><a href="#estimate" onClick={() => setMenuOpen(false)}>Contact</a></nav>
        <a className="header-cta" href="#estimate">Request an estimate <span aria-hidden="true">↗</span></a>
      </header>

      <main id="top">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy"><p className="micro">AUSTIN AREA ROOFING</p><h1 id="hero-title"><span>Roofing, with</span><span className="hero-title-accent">a clearer plan.</span></h1><p className="hero-lede">Roof repair, replacement, and inspections for homes across the Austin area. See the work, understand the cost, and decide what comes next.</p><div className="hero-actions"><a className="button button-dark" href="#estimate">Request an estimate <span aria-hidden="true">↗</span></a><a className="text-link" href="#services">Explore services</a></div></div>
          <div className="hero-image"><img src="/images/roof-home.webp" alt="Charcoal shingle roof on a white house in warm evening light" fetchPriority="high" /><div className="image-note">Inspection first. A written scope next.</div></div>
          <div className="hero-foot"><span>Inspection · Repair · Replacement</span><span>Fictional service area · Austin, Texas</span></div>
        </section>

        <section id="services" className="services section-pad wrap" aria-labelledby="services-title"><div className="section-intro"><p className="micro">WHAT WE DO</p><h2 id="services-title">Roof care for your home.</h2><p>Start with a clear assessment. Then choose a repair or replacement with a written scope.</p></div><div className="service-grid">
          <article className="service repair"><div className="service-img"><img src="/images/roof-repair.webp" alt="A roofer replacing an asphalt shingle" loading="lazy" /></div><div className="service-copy"><h3>Roof repair</h3><p>For leaks, lifted shingles, flashing, and small storm damage. A scoped repair makes sense when the rest of the roof has life left.</p><button type="button" className="inline-action" onClick={() => selectService('repair')}>Explore repair <span aria-hidden="true">↗</span></button></div></article>
          <article className="service replacement"><div className="service-img"><img src="/images/roof-detail.webp" alt="New charcoal shingles installed on a pitched roof" loading="lazy" /></div><div className="service-copy"><h3>Roof replacement</h3><p>A full tear-off and new roofing system when repeated patches no longer add up. The estimate should spell out materials, timing, and cleanup.</p><a className="inline-action" href="#estimate" onClick={() => track('service_viewed', { service: 'replacement' })}>Request replacement estimate <span aria-hidden="true">↗</span></a></div></article>
          <article className="service inspection"><div className="service-img"><img src="/images/roof-inspection.webp" alt="An inspector assessing a residential roof" loading="lazy" /></div><div className="service-copy"><h3>Roof inspection</h3><p>A practical starting point before a sale, after a storm, or whenever a ceiling stain raises a question.</p><button type="button" className="inline-action" onClick={() => selectService('inspection')}>Explore inspection <span aria-hidden="true">↗</span></button></div></article>
        </div></section>

        <section className="service-picker wrap" aria-labelledby="picker-title"><div><p className="micro">CHOOSE A STARTING POINT</p><h2 id="picker-title">What does your roof need?</h2></div><div className="picker-body"><div className="picker-tabs" role="group" aria-label="Select a service">{(Object.keys(checkoutItems) as CheckoutItem[]).map((key) => <button key={key} type="button" className={selected === key ? 'active' : ''} onClick={() => selectService(key)} aria-pressed={selected === key}>{checkoutItems[key].title}</button>)}</div><div className="picker-result"><div><h3>{checkoutItems[selected].title}</h3><p>{checkoutItems[selected].description}</p></div><strong>${checkoutItems[selected].price}</strong></div><a className="button button-gold" href={`/checkout/${selected}`} onClick={() => selected === 'deposit' && track('deposit_started', { value: site.prices.deposit, currency: 'USD' })}>Continue to checkout <span aria-hidden="true">↗</span></a><p className="fine-print">This is a live payment form for a fictional demo business. Completing it may charge you.</p></div></section>

        <section id="process" className="process section-pad" aria-labelledby="process-title"><div className="wrap process-inner"><div className="process-heading"><p className="micro">FROM FIRST LOOK TO FINISHED ROOF</p><h2 id="process-title">A job with a clear path.</h2></div><ol className="process-steps"><li><h3>Tell us what happened</h3><p>Share the address, the issue, and a good way to reach you. The estimate request is saved to your estimate requests.</p></li><li><h3>Review the scope</h3><p>See what work is needed and what it costs. The $500 sample project deposit uses secure checkout.</p></li><li><h3>Finish, then settle up</h3><p>After a deposit, the buyer can authorize saving a payment method. The contractor can create a final-balance invoice using the included script.</p></li></ol></div></section>

        <section className="pricing section-pad wrap" aria-labelledby="pricing-title"><div><p className="micro">SAMPLE PRICING</p><h2 id="pricing-title">A clear first number.</h2><p>Every roof is different. These three examples make the starting price and deposit easy to understand.</p></div><div className="price-list"><div><h3>Roof inspection</h3><p>On-site assessment with a written summary</p><strong>${site.prices.inspection}</strong></div><div><h3>Project deposit</h3><p>Applied to an approved project scope</p><strong>${site.prices.deposit}</strong></div><div><h3>Minor roof repair</h3><p>Example flat rate for a scoped repair</p><strong>${site.prices.repair}</strong></div><p className="fine-print">Sample prices for a demo business. Payment Elements are live and may charge; replace the plans and terms before using this for a contractor.</p></div></section>

        <section className="finance-band" aria-labelledby="finance-title"><div className="wrap finance-inner"><div><p className="micro">PAYMENT FLEXIBILITY</p><h2 id="finance-title">Flexible ways to pay.</h2></div><p>Checkout may offer card, wallet, and financing methods based on merchant approval, buyer eligibility, location, and device. The payment form displays the methods available to each buyer.</p><a className="button button-light" href="/checkout/deposit" onClick={() => track('deposit_started', { value: site.prices.deposit, currency: 'USD' })}>Deposit checkout <span aria-hidden="true">↗</span></a></div></section>

        <section className="trust section-pad wrap" aria-labelledby="trust-title"><div><p className="micro">BUILT FOR TRUST</p><h2 id="trust-title">The details homeowners check.</h2><p>This template gives a real contractor space for verified licenses, warranties, project photos, and customer reviews. Add those facts before publishing it for a business.</p></div><div className="trust-card"><h3>Proof belongs here.</h3><p>Add a real customer review, license details, warranty terms, or a completed project. This fictional company has no customer reviews.</p></div></section>

        <section id="area" className="area section-pad wrap" aria-labelledby="area-title"><div><p className="micro">WHERE WE WORK</p><h2 id="area-title">Close to home, when it matters.</h2><p>Example coverage for this template. Swap these locations for the contractor’s actual service radius.</p></div><ul>{site.serviceArea.map((area) => <li key={area}>{area}<span aria-hidden="true">↗</span></li>)}</ul></section>

        <section id="estimate" className="estimate section-pad" aria-labelledby="estimate-title"><div className="wrap estimate-inner"><div><p className="micro">START HERE</p><h2 id="estimate-title">Tell us about your roof.</h2><p>Describe the issue, then sign in securely to save this request to the demo business's estimate records.</p><div className="contact-photo"><img src="/images/roof-detail.webp" alt="Detail of a newly shingled roof" loading="lazy" /></div></div><form onSubmit={onEstimate}><div className="form-row"><label>Full name<input name="name" autoComplete="name" maxLength={100} required /></label><label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label></div><div className="form-row"><label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40} required /></label><label>ZIP code<input name="zip" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" required /></label></div><label>What do you need?<select name="service" defaultValue="" required><option value="" disabled>Choose a service</option><option>Inspection</option><option>Repair</option><option>Replacement</option><option>Not sure yet</option></select></label><label>What is going on?<textarea name="message" rows={4} maxLength={1500} placeholder="A leak near the chimney, missing shingles after a storm…" /></label><label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label><button className="button button-gold" type="submit" disabled={formStatus === 'loading'}>{formStatus === 'loading' ? 'Connecting…' : 'Request an estimate'} <span aria-hidden="true">↗</span></button><p className="form-disclosure">Demo form: Account sign-in is required. Your details are stored in the demo business’s estimate records. Email confirmations are sent only to the configured test inbox and must match your account email. Do not submit private project information.</p>{formStatus === 'error' && <p className="form-error" role="alert">{formError}</p>}</form></div></section>
      </main>

      <footer className="site-footer"><div className="wrap footer-top"><div><strong>Ridge & Row</strong><span>Original roofing website template.<br />Demo business, not an operating contractor.</span></div><div><strong>Explore</strong><a href="#services">Services</a><a href="#process">How it works</a><a href="#estimate">Estimate</a></div><div><strong>Example area</strong><span>{site.city}</span><span>{site.serviceArea.slice(1, 3).join(' · ')}</span></div><div><strong>Template note</strong><span>Replace prices, reviews, service area, and contact details before using this for a real business.</span></div></div><div className="wrap footer-wordmark">RIDGE <em>&</em> ROW</div><div className="wrap footer-bottom"><span>© {new Date().getFullYear()} Ridge & Row demo</span><span><a href="/operator">Operator workspace</a> · Roofing website template</span></div></footer>
    </>
  )
}

function RoofMark() { return <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true"><path d="M3 23.5 21 7l18 16.5" stroke="currentColor" strokeWidth="2.5"/><path d="M8 23v11h26V23M14 28h14" stroke="currentColor" strokeWidth="2"/></svg> }

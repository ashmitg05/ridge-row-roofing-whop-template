import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { completeEstimateSignIn } from '../../estimate-oauth'
import { submitEstimate } from '../../server/estimate'
import { track } from '../../tracking'

export const Route = createFileRoute('/oauth/callback')({ component: EstimateCallback })

function EstimateCallback() {
  const started = useRef(false)
  const [result, setResult] = useState<'working' | 'success' | 'error'>('working')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true
    async function finish() {
      try {
        const { token, estimate } = await completeEstimateSignIn()
        const response = await submitEstimate({ data: { ...estimate, accessToken: token } })
        if (!response.leadId) throw new Error('The request was not saved. Please try again.')
        track('estimate_requested', { event_id: response.leadId, service: estimate.service })
        setResult('success')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'The request could not be saved.')
        setResult('error')
      }
    }
    void finish()
  }, [])

  return <main className="callback-page"><div className="callback-card"><p className="micro">RIDGE & ROW ROOFING DEMO</p>{result === 'working' && <><h1>Saving your request.</h1><p>Whop is confirming your sign-in and adding the estimate to Leads.</p></>}{result === 'success' && <><h1>Request received.</h1><p>Your estimate request is saved in Whop Leads for this demo business.</p></>}{result === 'error' && <><h1>We could not save it.</h1><p role="alert">{message}</p></>}<a className="button button-dark" href="/#estimate">Back to the website <span aria-hidden="true">↗</span></a></div></main>
}

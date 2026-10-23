import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { completeWhopSignIn, operatorStorageKey } from '../../estimate-oauth'
import { submitEstimate } from '../../server/estimate'
import { track } from '../../tracking'

export const Route = createFileRoute('/oauth/callback')({ component: EstimateCallback })

function EstimateCallback() {
  const started = useRef(false)
  const [result, setResult] = useState<'working' | 'success' | 'error'>('working')
  const [message, setMessage] = useState('')
  const [leadId, setLeadId] = useState('')
  const [emailMessage, setEmailMessage] = useState('')

  useEffect(() => {
    if (started.current) return
    started.current = true
    async function finish() {
      try {
        const { token, intent } = await completeWhopSignIn()
        if (intent.purpose === 'operator') {
          sessionStorage.setItem(operatorStorageKey, token)
          window.location.assign('/operator')
          return
        }
        const estimate = intent.estimate
        const response = await submitEstimate({ data: { ...estimate, accessToken: token } })
        if (!response.leadId) throw new Error('The request was not saved. Please try again.')
        track('estimate_requested', { event_id: response.leadId, service: estimate.service })
        setLeadId(response.leadId)
        setEmailMessage(response.email.status === 'accepted' ? 'A confirmation email has been submitted for delivery to your inbox.' : response.email.status === 'restricted' ? 'This demo sends email only to its configured test inbox, using the email on your account.' : 'Your request is saved. Confirmation email is currently unavailable.')
        setResult('success')
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'The request could not be saved.')
        setResult('error')
      }
    }
    void finish()
  }, [])

  return <main className="callback-page"><div className="callback-card"><p className="micro">RIDGE & ROW ROOFING DEMO</p>{result === 'working' && <><h1>Confirming your sign-in.</h1><p>The payment provider is securely confirming this request.</p></>}{result === 'success' && <><h1>Request received.</h1><p>Your estimate request is saved in estimate requests for this demo business.</p><p>{emailMessage}</p><p>Reference: <code>{leadId}</code></p></>}{result === 'error' && <><h1>We could not save it.</h1><p role="alert">{message}</p></>}<a className="button button-dark" href="/#estimate">Back to the website <span aria-hidden="true">↗</span></a></div></main>
}

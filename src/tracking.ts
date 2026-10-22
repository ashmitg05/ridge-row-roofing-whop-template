declare global {
  interface Window {
    whop?: { track: (event: string, properties?: Record<string, unknown>) => void }
  }
}

export function track(event: 'estimate_requested' | 'service_viewed' | 'deposit_started', properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined') window.whop?.track(event, properties)
}

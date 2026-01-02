'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker on production only
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[SW] Service Worker registered:', registration.scope)

            // Check for updates periodically
            setInterval(() => {
              registration.update()
            }, 60 * 60 * 1000) // Every hour
          })
          .catch((error) => {
            console.error('[SW] Service Worker registration failed:', error)
          })
      }

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_VENDAS') {
          // Dispatch custom event for the app to handle
          window.dispatchEvent(new CustomEvent('sync-vendas'))
        }
      })
    }
  }, [])

  return null
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { syncNow } from './data/sync'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

void syncNow()
window.addEventListener('focus', () => { void syncNow() })
window.addEventListener('online', () => { void syncNow() })

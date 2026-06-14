import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/app'
import { applyFont } from './helpers/font'

// Apply the saved font before first paint so there's no flash of the default.
applyFont()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

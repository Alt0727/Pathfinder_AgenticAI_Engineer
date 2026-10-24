import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.jsx'
import DevPage from './dev/DevPage.jsx'

// ?dev → the backend test page (app-api tests, agent panel, hook counts); otherwise the unmute app.
const dev = new URLSearchParams(window.location.search).has('dev')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {dev ? <DevPage /> : <Root />}
  </StrictMode>,
)

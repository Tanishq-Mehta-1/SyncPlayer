import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import './index.css'
import './index_y2k.css'
import App from './App.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

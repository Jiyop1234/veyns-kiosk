import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthGate from './components/auth-gate'
// @ts-ignore
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
)
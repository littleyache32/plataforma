import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './product-theme.css'
import { syncOfflineQueue } from './api.js'

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
window.addEventListener('online', () => syncOfflineQueue())
syncOfflineQueue()

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)

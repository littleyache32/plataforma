import { useEffect, useState } from 'react'
import { syncOfflineQueue } from '../api.js'

export default function OfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => { const up = () => { setOnline(true); syncOfflineQueue() }; const down = () => setOnline(false); window.addEventListener('online', up); window.addEventListener('offline', down); return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) } }, [])
  return <span className={`offline-status ${online ? 'online' : 'offline'}`}>{online ? 'Sincronizado' : 'Modo offline'}</span>
}

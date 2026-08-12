const queueKey = 'mentor-offline-queue-v1'
const queueable = ['/api/pratica','/api/questoes','/api/tempo','/api/sessoes']
const operationId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
const openQueue = () => new Promise((resolve, reject) => { const request = indexedDB.open(queueKey, 1); request.onupgradeneeded = () => request.result.createObjectStore('requests', { keyPath: 'id', autoIncrement: true }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
const readQueue = async () => { const db = await openQueue(); return new Promise((resolve, reject) => { const request = db.transaction('requests').objectStore('requests').getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error) }) }
const replaceQueue = async (items) => { const db = await openQueue(); return new Promise((resolve, reject) => { const transaction = db.transaction('requests', 'readwrite'); const store = transaction.objectStore('requests'); store.clear(); items.forEach((item) => { const queued = { path: item.path, options: item.options }; store.add(queued) }); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error) }) }
const addQueue = async (item) => { const db = await openQueue(); return new Promise((resolve, reject) => { const request = db.transaction('requests', 'readwrite').objectStore('requests').add(item); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error) }) }

export async function syncOfflineQueue() {
  const pending = await readQueue()
  if (!navigator.onLine) return { pendentes: pending.length }
  const remaining = []
  for (const item of pending) {
    try { const response = await fetch(item.path, { credentials:'same-origin', ...item.options }); if (!response.ok && response.status >= 500) remaining.push(item) } catch { remaining.push(item) }
  }
  await replaceQueue(remaining); return { pendentes: remaining.length }
}

export async function api(path, options = {}) {
  let requestOptions = { credentials: 'same-origin', ...options, headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers }
  if (options.body && queueable.some((prefix) => path.startsWith(prefix))) {
    const parsed = JSON.parse(options.body); if (!parsed.operacaoId) parsed.operacaoId = operationId()
    requestOptions = { ...requestOptions, body: JSON.stringify(parsed) }
  }
  let response
  try { response = await fetch(path, requestOptions) } catch (error) {
    if (requestOptions.method && requestOptions.method !== 'GET' && queueable.some((prefix) => path.startsWith(prefix))) { await addQueue({path,options:{...requestOptions,credentials:undefined}}); return {offline:true,pendente:true} }
    throw error
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'A operacao falhou.')
    error.status = response.status
    if (data.timer) error.timer = data.timer
    throw error
  }
  return data
}

export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

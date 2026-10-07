import { api } from '../api.js'

export async function loadDemandReason(id, request = api) {
  try {
    const result = await request(`/api/mentor?recurso=demanda&id=${encodeURIComponent(id)}`)
    return typeof result.explicacao === 'string' && result.explicacao.length <= 160 ? result.explicacao : ''
  } catch { return 'Não foi possível consultar o motivo.' }
}

export default function DemandReason({ text }) {
  return text ? <p className="muted" role="status">{text}</p> : null
}

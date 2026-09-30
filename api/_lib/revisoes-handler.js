import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'
import { currentPracticeFlags } from '../../shared/study-access.js'

export default async function handler(req, res) {
  if (!allowMethods(req,res,['GET']) || !requireAccess(req,res)) return
  try {
    const supabase=getSupabaseAdmin(); const objectiveId=queryParam(req,'objetivoId'); const now=new Date().toISOString(); const flags=await currentPracticeFlags(supabase); const cardsReleased=flags.question_cards
    let questions=supabase.from('revisao_item').select('id,motivo,prioridade,agendada_para,questao:questao_id(id,enunciado,topico_id,topico:topico_id(nome,materia:materia_id(id,nome,objetivo_id)))').eq('status','pendente').lte('agendada_para',now).order('prioridade').order('agendada_para').limit(100)
    const cards=cardsReleased?supabase.from('question_card').select('id,frente,proxima_revisao,topico_id,topico:topico_id(nome,materia:materia_id(id,nome,objetivo_id))').eq('ativa',true).lte('proxima_revisao',now).order('proxima_revisao').limit(100):Promise.resolve({data:[],error:null})
    if (!flags.revisao_pratica) questions = Promise.resolve({ data: [], error: null })
    const [q,c]=await Promise.all([questions,cards]); if(q.error||c.error) throw q.error||c.error
    const qItems=(q.data||[]).filter((x)=>!objectiveId||x.questao?.topico?.materia?.objetivo_id===objectiveId).map((x)=>({ tipo:'questao',id:x.id,item_id:x.questao.id,topico_id:x.questao.topico_id,materia_id:x.questao.topico?.materia?.id,titulo:x.questao.enunciado,materia:x.questao.topico?.materia?.nome,topico:x.questao.topico?.nome,prioridade:x.prioridade,data:x.agendada_para,agendada_para:x.agendada_para,motivo:x.motivo }))
    const cItems=(c.data||[]).filter((x)=>!objectiveId||x.topico?.materia?.objetivo_id===objectiveId).map((x)=>({ tipo:'card',id:x.id,item_id:x.id,topico_id:x.topico_id,materia_id:x.topico?.materia?.id,titulo:x.frente,materia:x.topico?.materia?.nome,topico:x.topico?.nome,prioridade:2,data:x.proxima_revisao,agendada_para:x.proxima_revisao,motivo:'Question Card vencido' }))
    return res.status(200).json({ itens:[...qItems,...cItems].sort((a,b)=>a.prioridade-b.prioridade||new Date(a.data)-new Date(b.data)), questoes:qItems.length,cards:cItems.length })
  } catch(error){ return fail(res,error,'Nao foi possivel montar a central de revisao.') }
}

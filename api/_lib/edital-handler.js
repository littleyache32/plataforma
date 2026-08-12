import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'

export default async function handler(req,res){
  if(!allowMethods(req,res,['GET','POST','PATCH'])||!requireAccess(req,res)) return
  const supabase=getSupabaseAdmin()
  try{
    if(req.method==='GET'){
      const objetivoId=queryParam(req,'objetivoId'); let query=supabase.from('edital_versao').select('id,nome,publicado_em,ativo,criado_em,itens:edital_item(id,nome,classificacao,impacto,topico_id)').order('criado_em',{ascending:false}); if(objetivoId) query=query.eq('objetivo_id',objetivoId)
      const result=await query; if(result.error) throw result.error
      return res.status(200).json({editais:result.data||[]})
    }
    if(req.method==='POST'){
      const {objetivoId,nome,publicadoEm,itens=[]}=req.body||{}; if(!objetivoId||!nome) return res.status(400).json({error:'Objetivo e nome do edital sao obrigatorios.'})
      const version=await supabase.from('edital_versao').insert({objetivo_id:objetivoId,nome:String(nome).trim(),publicado_em:publicadoEm||null}).select('id').single(); if(version.error) throw version.error
      if(itens.length){const rows=itens.slice(0,500).map((item)=>({edital_id:version.data.id,nome:String(item.nome||'').trim(),classificacao:['mantido','novo','removido','sem_material'].includes(item.classificacao)?item.classificacao:'novo',impacto:String(item.impacto||'').trim()||null,topico_id:item.topicoId||null})).filter((x)=>x.nome); const inserted=await supabase.from('edital_item').insert(rows); if(inserted.error) throw inserted.error}
      return res.status(201).json({id:version.data.id})
    }
    const {id,classificacao,impacto,arquivar=false}=req.body||{}; if(!id||!['mantido','novo','removido','sem_material'].includes(classificacao)) return res.status(400).json({error:'Item e classificacao validos sao obrigatorios.'})
    const updated=await supabase.from('edital_item').update({classificacao,impacto:String(impacto||'').trim()||null}).eq('id',id).select('topico_id').single(); if(updated.error) throw updated.error
    let arquivados={questoes:0,cards:0}
    if(arquivar&&classificacao==='removido'&&updated.data.topico_id){
      const [questions,cards]=await Promise.all([supabase.from('questao').update({ativa:false,estado:'arquivada'}).eq('topico_id',updated.data.topico_id).select('id'),supabase.from('question_card').update({ativa:false}).eq('topico_id',updated.data.topico_id).select('id')])
      if(questions.error||cards.error) throw questions.error||cards.error
      arquivados={questoes:questions.data?.length||0,cards:cards.data?.length||0}
    }
    return res.status(200).json({ok:true,arquivados})
  }catch(error){return fail(res,error,'Nao foi possivel processar o comparador de edital.')}
}

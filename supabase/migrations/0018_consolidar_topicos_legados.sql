create temporary table topic_merge_map (
  materia text not null,
  antigo text not null,
  novo text
) on commit drop;

insert into topic_merge_map (materia, antigo, novo) values
  ('Português e Redação Oficial', 'Compreensão e interpretação de textos', 'Compreensão, interpretação e estrutura textual'),
  ('Português e Redação Oficial', 'Gramática e emprego da língua portuguesa', 'Sintaxe da oração e do período'),
  ('Português e Redação Oficial', 'Redação oficial', 'Comunicações de rotina e redação profissional'),
  ('Raciocínio Lógico e Quantitativo', 'Lógica proposicional e argumentação', 'Lógica proposicional'),
  ('Contabilidade', 'Contabilidade geral', 'Teoria, objetivos e patrimônio'),
  ('Direito Constitucional', 'Princípios fundamentais e direitos fundamentais', 'Constituição e princípios fundamentais'),
  ('Direito Constitucional', 'Organização do Estado e dos Poderes', 'Organização e separação dos Poderes'),
  ('Direito Constitucional', 'Administração pública na Constituição', 'Administração pública e servidores na Constituição'),
  ('Direito Administrativo e Lei 8.112', 'Regime jurídico dos servidores públicos federais', 'Lei 8.112: disposições, provimento e vacância'),
  ('Gestão de Pessoas', 'Gestão por competências e desempenho', 'Gestão por competências e resultados'),
  ('Gestão de Pessoas', 'Liderança, motivação e comportamento organizacional', 'Comportamento organizacional'),
  ('Gestão de Materiais e Patrimônio', 'Compras, estoques e armazenagem', 'Compras e contratações'),
  ('Gestão de Materiais e Patrimônio', 'Gestão patrimonial', 'Administração patrimonial'),
  ('Gestão Pública e Ética', 'Modelos e processos de gestão pública', 'Administração estratégica e organização do Estado'),
  ('Gestão Pública e Ética', 'Ética, integridade e governança pública', 'Governança e gestão pública'),
  ('Informática', 'Segurança da informação', 'Segurança da informação e backups'),
  ('Informática', 'Redes, internet e computação em nuvem', 'Redes, internet, intranet e navegação'),
  ('Informática', 'Sistemas operacionais e ferramentas de escritório', 'Sistemas operacionais Windows e Linux'),
  ('Direito das Pessoas e dos Negócios Jurídicos', 'Conteúdo inicial da disciplina', null),
  ('Teoria da Constituição e Direitos Fundamentais', 'Conteúdo inicial da disciplina', null),
  ('Teoria do Crime', 'Conteúdo inicial da disciplina', null),
  ('Teorias da Justiça', 'Conteúdo inicial da disciplina', null);

do $$
declare
  item record;
  old_id uuid;
  new_id uuid;
begin
  for item in select * from topic_merge_map loop
    select t.id into old_id from topico t join materia m on m.id=t.materia_id where m.nome=item.materia and t.nome=item.antigo;
    if old_id is null then continue; end if;
    if item.novo is null then
      delete from topico where id=old_id;
      continue;
    end if;
    select t.id into new_id from topico t join materia m on m.id=t.materia_id where m.nome=item.materia and t.nome=item.novo;
    if new_id is null then continue; end if;

    delete from questao old_q
    using questao new_q
    where old_q.topico_id=old_id and new_q.topico_id=new_id and md5(lower(old_q.enunciado))=md5(lower(new_q.enunciado));
    update questao set topico_id=new_id where topico_id=old_id;
    update question_card set topico_id=new_id where topico_id=old_id;
    update conhecimento set topico_id=new_id where topico_id=old_id;
    update sessao set topico_id=new_id where topico_id=old_id;
    update seeding_job set topico_id=new_id where topico_id=old_id;
    update mentor_decisao set topico_id=new_id where topico_id=old_id;
    delete from acervo_meta where topico_id=old_id;
    delete from topico where id=old_id;
  end loop;
end $$;

insert into acervo_meta (topico_id, questoes_alvo, cards_alvo, expansao_bloqueada, motivo_bloqueio)
select t.id, 20, 20, false, null
from topico t
join materia m on m.id=t.materia_id
join objetivo o on o.id=m.objetivo_id
where o.ativo=true and lower(m.nome) not in ('análise e produção de texto','analise e producao de texto')
on conflict (topico_id) do update
set questoes_alvo=20, cards_alvo=20, expansao_bloqueada=false, motivo_bloqueio=null, atualizado_em=now();

delete from questao
where topico_id in (
  select t.id from topico t join materia m on m.id=t.materia_id where lower(m.nome) in ('análise e produção de texto','analise e producao de texto')
);

delete from question_card
where materia_id in (
  select id from materia where lower(nome) in ('análise e produção de texto','analise e producao de texto')
);

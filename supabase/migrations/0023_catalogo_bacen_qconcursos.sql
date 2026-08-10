-- Catálogo BACEN confirmado pelo usuário em 10/08/2026.
-- A faculdade não é alterada. Conteúdo só é movido quando há correspondência temática.

do $$
declare
  bacen_id uuid;
begin
  select id into bacen_id from objetivo where tipo = 'concurso' and ativo = true order by criado_em limit 1;
  if bacen_id is null then raise exception 'Objetivo BACEN ativo não encontrado.'; end if;

  update materia set nome = 'Português' where objetivo_id = bacen_id and nome = 'Português e Redação Oficial';
  update materia set nome = 'Raciocínio Lógico' where objetivo_id = bacen_id and nome = 'Raciocínio Lógico e Quantitativo';
  update materia set nome = 'Contabilidade Geral' where objetivo_id = bacen_id and nome = 'Contabilidade';
  update materia set nome = 'Direito Administrativo' where objetivo_id = bacen_id and nome = 'Direito Administrativo e Lei 8.112';
  update materia set nome = 'Administração de Recursos Materiais' where objetivo_id = bacen_id and nome = 'Gestão de Materiais e Patrimônio';
  update materia set nome = 'Noções de Informática' where objetivo_id = bacen_id and nome = 'Informática';
end $$;

create temporary table catalogo_bacen_desejado (
  materia text not null,
  topico text not null,
  ordem integer not null,
  primary key (materia, topico)
) on commit drop;

insert into catalogo_bacen_desejado (materia, topico, ordem) values
  ('Português', 'Ortografia', 1),
  ('Português', 'Morfologia', 2),
  ('Português', 'Morfologia - Verbos', 3),
  ('Português', 'Morfologia - Pronomes', 4),
  ('Português', 'Sintaxe', 5),
  ('Português', 'Pontuação', 6),
  ('Português', 'Interpretação de Textos', 7),
  ('Direito Constitucional', 'Teoria da Constituição', 8),
  ('Direito Constitucional', 'Princípios Fundamentais da República', 9),
  ('Direito Constitucional', 'Teoria dos Direitos Fundamentais', 10),
  ('Direito Constitucional', 'Direitos Individuais', 11),
  ('Direito Constitucional', 'Direitos Individuais - Remédios Constitucionais e Garantias Processuais', 12),
  ('Direito Constitucional', 'Direitos Sociais', 13),
  ('Direito Constitucional', 'Administração Pública - Disposições Gerais e Servidores Públicos', 14),
  ('Direito Constitucional', 'Organização dos Poderes', 15),
  ('Direito Constitucional', 'Poder Legislativo', 16),
  ('Direito Constitucional', 'Poder Executivo', 17),
  ('Direito Constitucional', 'Poder Judiciário', 18),
  ('Direito Constitucional', 'Organização do Poder Judiciário', 19),
  ('Direito Administrativo', 'Regime jurídico administrativo', 20),
  ('Direito Administrativo', 'Atos administrativos', 21),
  ('Direito Administrativo', 'Serviços Públicos', 22),
  ('Direito Administrativo', 'Agentes públicos e Lei 8.112 de 1990', 23),
  ('Direito Administrativo', 'Improbidade administrativa - Lei nº 8.429 de 1992 e Lei nº 14.230 de 2021', 24),
  ('Direito Administrativo', 'Licitações e Lei 8.666 de 1993.', 25),
  ('Administração Pública', 'Organização e Estrutura do Estado, Governo e Administração', 26),
  ('Administração Pública', 'Gestão de Políticas Públicas', 27),
  ('Administração Pública', 'Governabilidade, Governança e Accountability', 28),
  ('Administração Pública', 'Modelos teóricos de Administração Pública', 29),
  ('Administração Geral', 'Gestão Estratégica', 30),
  ('Administração Geral', 'Organizações, Sistemas e Métodos', 31),
  ('Ética na Administração Pública', 'Introdução, Ética e Moral e Orientações Gerais', 32),
  ('Ética na Administração Pública', 'Código de Ética Profissional do Servidor Público Civil do Poder Executivo Federal - Decreto nº 1.171 de 1994', 33),
  ('Noções de Informática', 'Sistema Operacional', 34),
  ('Noções de Informática', 'Windows Explorer - conceitos de organização de pastas e arquivos', 35),
  ('Noções de Informática', 'Editor de Textos - Microsoft Word e BrOffice.org Writer', 36),
  ('Noções de Informática', 'Redes de Computadores', 37),
  ('Noções de Informática', 'Internet', 38),
  ('Noções de Informática', 'Segurança da Informação', 39),
  ('Noções de Informática', 'Navegadores (Browser)', 40),
  ('Noções de Informática', 'Correio Eletrônico (cliente de e-mail e webmail)', 41),
  ('Raciocínio Lógico', 'Fundamentos de Lógica', 42),
  ('Raciocínio Lógico', 'Equivalência Lógica e Negação de Proposições', 43),
  ('Raciocínio Lógico', 'Lógica de Argumentação - Diagramas e Operadores Lógicos', 44),
  ('Raciocínio Lógico', 'Diagramas de Venn (Conjuntos)', 45),
  ('Raciocínio Lógico', 'Probabilidade', 46),
  ('Raciocínio Lógico', 'Problemas Lógicos Com Dados, Figuras e Palitos', 47),
  ('Raciocínio Lógico', 'Problemas Lógicos', 48),
  ('Raciocínio Lógico', 'Raciocínio Matemático', 49),
  ('Contabilidade Geral', 'Contabilidade - Noções Gerais', 50),
  ('Contabilidade Geral', 'Balanço Patrimonial', 51),
  ('Contabilidade Geral', 'Demonstração do Resultado do Exercício', 52),
  ('Contabilidade Geral', 'Outras Demonstrações', 53),
  ('Contabilidade Geral', 'Demonstração dos Fluxos de Caixa - DFC', 54),
  ('Contabilidade Geral', 'Demonstração do Valor Adicionado - DVA', 55),
  ('Administração de Recursos Materiais', 'Administração de Estoques', 56),
  ('Administração de Recursos Materiais', 'Conceitos Básicos na Administração de Recursos Materiais', 57),
  ('Administração de Recursos Materiais', 'Classificação de Materiais', 58),
  ('Administração de Recursos Materiais', 'Administração de Compras', 59),
  ('Administração de Recursos Materiais', 'Armazenagem', 60),
  ('Administração de Recursos Materiais', 'Administração Patrimonial', 61),
  ('Gestão de Pessoas', 'Agregando Pessoas', 62),
  ('Gestão de Pessoas', 'Desenvolvendo Pessoas', 63),
  ('Gestão de Pessoas', 'Remuneração e Benefícios', 64),
  ('Gestão de Pessoas', 'Desenho de Cargos', 65),
  ('Gestão de Pessoas', 'Gestão de Competências', 66),
  ('Gestão de Pessoas', 'Comportamento de Pessoas nas Organizações', 67),
  ('Gestão de Pessoas', 'Gestão Participativa e Trabalho em Equipe', 68),
  ('Gestão de Pessoas', 'Qualidade de vida no trabalho', 69),
  ('Arquivologia', 'Conceitos Fundamentais', 70),
  ('Arquivologia', 'Gestão de Documentos / Arquivos Corrente e Intermediário', 71);

insert into materia (objetivo_id, nome)
select o.id, d.materia
from objetivo o
cross join (select distinct materia from catalogo_bacen_desejado) d
where o.tipo = 'concurso' and o.ativo = true
on conflict (objetivo_id, nome) do nothing;

insert into topico (materia_id, nome)
select m.id, d.topico
from catalogo_bacen_desejado d
join objetivo o on o.tipo = 'concurso' and o.ativo = true
join materia m on m.objetivo_id = o.id and m.nome = d.materia
on conflict (materia_id, nome) do nothing;

create temporary table mapa_topicos_bacen (
  materia_antiga text not null,
  topico_antigo text not null,
  materia_nova text not null,
  topico_novo text not null
) on commit drop;

insert into mapa_topicos_bacen values
  ('Português', 'Ortografia, acentuação e semântica', 'Português', 'Ortografia'),
  ('Português', 'Morfologia e classes de palavras', 'Português', 'Morfologia'),
  ('Português', 'Sintaxe da oração e do período', 'Português', 'Sintaxe'),
  ('Português', 'Pontuação, coesão e reescrita', 'Português', 'Pontuação'),
  ('Português', 'Compreensão, interpretação e estrutura textual', 'Português', 'Interpretação de Textos'),
  ('Direito Constitucional', 'Constituição e princípios fundamentais', 'Direito Constitucional', 'Princípios Fundamentais da República'),
  ('Direito Constitucional', 'Direitos e deveres individuais e coletivos', 'Direito Constitucional', 'Direitos Individuais'),
  ('Direito Constitucional', 'Direitos sociais, nacionalidade e direitos políticos', 'Direito Constitucional', 'Direitos Sociais'),
  ('Direito Constitucional', 'Administração pública e servidores na Constituição', 'Direito Constitucional', 'Administração Pública - Disposições Gerais e Servidores Públicos'),
  ('Direito Constitucional', 'Organização e separação dos Poderes', 'Direito Constitucional', 'Organização dos Poderes'),
  ('Direito Administrativo', 'Atos administrativos', 'Direito Administrativo', 'Atos administrativos'),
  ('Direito Administrativo', 'Atos e poderes administrativos', 'Direito Administrativo', 'Atos administrativos'),
  ('Direito Administrativo', 'Extinção e controle dos atos administrativos', 'Direito Administrativo', 'Atos administrativos'),
  ('Direito Administrativo', 'Lei 8.112: disposições, provimento e vacância', 'Direito Administrativo', 'Agentes públicos e Lei 8.112 de 1990'),
  ('Direito Administrativo', 'Lei 8.112: deveres, proibições e responsabilidades', 'Direito Administrativo', 'Agentes públicos e Lei 8.112 de 1990'),
  ('Direito Administrativo', 'Lei 8.112: direitos e vantagens', 'Direito Administrativo', 'Agentes públicos e Lei 8.112 de 1990'),
  ('Direito Administrativo', 'Lei 8.112: penalidades e processo disciplinar', 'Direito Administrativo', 'Agentes públicos e Lei 8.112 de 1990'),
  ('Direito Administrativo', 'Lei 8.112: seguridade e disposições finais', 'Direito Administrativo', 'Agentes públicos e Lei 8.112 de 1990'),
  ('Direito Administrativo', 'Licitações e contratos', 'Direito Administrativo', 'Licitações e Lei 8.666 de 1993.'),
  ('Gestão Pública e Ética', 'Agentes públicos e gestão de pessoas no setor público', 'Direito Administrativo', 'Agentes públicos e Lei 8.112 de 1990'),
  ('Gestão Pública e Ética', 'Administração estratégica e organização do Estado', 'Administração Pública', 'Organização e Estrutura do Estado, Governo e Administração'),
  ('Gestão Pública e Ética', 'Estado, governo e sociedade', 'Administração Pública', 'Organização e Estrutura do Estado, Governo e Administração'),
  ('Gestão Pública e Ética', 'Governança e gestão pública', 'Administração Pública', 'Governabilidade, Governança e Accountability'),
  ('Gestão Pública e Ética', 'Relacionamento, equipes e gestão de conflitos', 'Administração Geral', 'Gestão Estratégica'),
  ('Gestão Pública e Ética', 'Ética, moral, cidadania e função pública', 'Ética na Administração Pública', 'Introdução, Ética e Moral e Orientações Gerais'),
  ('Noções de Informática', 'Sistemas operacionais Windows e Linux', 'Noções de Informática', 'Sistema Operacional'),
  ('Noções de Informática', 'Organização de informações, arquivos e nuvem', 'Noções de Informática', 'Windows Explorer - conceitos de organização de pastas e arquivos'),
  ('Noções de Informática', 'LibreOffice Writer, Calc e Impress', 'Noções de Informática', 'Editor de Textos - Microsoft Word e BrOffice.org Writer'),
  ('Noções de Informática', 'Redes, internet, intranet e navegação', 'Noções de Informática', 'Internet'),
  ('Noções de Informática', 'Segurança da informação e backups', 'Noções de Informática', 'Segurança da Informação'),
  ('Noções de Informática', 'Correio eletrônico, colaboração e redes sociais', 'Noções de Informática', 'Correio Eletrônico (cliente de e-mail e webmail)'),
  ('Raciocínio Lógico', 'Lógica proposicional', 'Raciocínio Lógico', 'Fundamentos de Lógica'),
  ('Raciocínio Lógico', 'Estruturas lógicas e argumentação', 'Raciocínio Lógico', 'Fundamentos de Lógica'),
  ('Raciocínio Lógico', 'Equivalências, negações e Leis de De Morgan', 'Raciocínio Lógico', 'Equivalência Lógica e Negação de Proposições'),
  ('Raciocínio Lógico', 'Diagramas e lógica de primeira ordem', 'Raciocínio Lógico', 'Lógica de Argumentação - Diagramas e Operadores Lógicos'),
  ('Raciocínio Lógico', 'Conjuntos e problemas quantitativos', 'Raciocínio Lógico', 'Diagramas de Venn (Conjuntos)'),
  ('Raciocínio Lógico', 'Contagem e probabilidade', 'Raciocínio Lógico', 'Probabilidade'),
  ('Contabilidade Geral', 'Teoria, objetivos e patrimônio', 'Contabilidade Geral', 'Contabilidade - Noções Gerais'),
  ('Contabilidade Geral', 'Regimes e avaliação de ativos e passivos', 'Contabilidade Geral', 'Contabilidade - Noções Gerais'),
  ('Contabilidade Geral', 'Estoques e avaliação financeira', 'Contabilidade Geral', 'Balanço Patrimonial'),
  ('Contabilidade Geral', 'Imobilizado, depreciação e amortização', 'Contabilidade Geral', 'Balanço Patrimonial'),
  ('Contabilidade Geral', 'Patrimônio líquido, reservas e provisões', 'Contabilidade Geral', 'Balanço Patrimonial'),
  ('Contabilidade Geral', 'Apuração do resultado e operações comerciais', 'Contabilidade Geral', 'Demonstração do Resultado do Exercício'),
  ('Contabilidade Geral', 'Demonstrações contábeis', 'Contabilidade Geral', 'Outras Demonstrações'),
  ('Administração de Recursos Materiais', 'Previsão, estoques e reposição', 'Administração de Recursos Materiais', 'Administração de Estoques'),
  ('Administração de Recursos Materiais', 'Recursos materiais, patrimoniais e nível de serviço', 'Administração de Recursos Materiais', 'Conceitos Básicos na Administração de Recursos Materiais'),
  ('Administração de Recursos Materiais', 'Classificação, codificação e curva ABC', 'Administração de Recursos Materiais', 'Classificação de Materiais'),
  ('Administração de Recursos Materiais', 'Compras e contratações', 'Administração de Recursos Materiais', 'Administração de Compras'),
  ('Administração de Recursos Materiais', 'Armazenagem, movimentação e inventário', 'Administração de Recursos Materiais', 'Armazenagem'),
  ('Administração de Recursos Materiais', 'Administração patrimonial', 'Administração de Recursos Materiais', 'Administração Patrimonial'),
  ('Administração de Recursos Materiais', 'Imóveis, serviços e manutenção predial', 'Administração de Recursos Materiais', 'Administração Patrimonial'),
  ('Administração de Recursos Materiais', 'Protocolo, arquivos e temporalidade', 'Arquivologia', 'Gestão de Documentos / Arquivos Corrente e Intermediário'),
  ('Gestão de Pessoas', 'Recrutamento e seleção', 'Gestão de Pessoas', 'Agregando Pessoas'),
  ('Gestão de Pessoas', 'Educação corporativa e desenvolvimento', 'Gestão de Pessoas', 'Desenvolvendo Pessoas'),
  ('Gestão de Pessoas', 'Carreiras, desempenho e feedback', 'Gestão de Pessoas', 'Desenho de Cargos'),
  ('Gestão de Pessoas', 'Gestão por competências e resultados', 'Gestão de Pessoas', 'Gestão de Competências'),
  ('Gestão de Pessoas', 'Comportamento organizacional', 'Gestão de Pessoas', 'Comportamento de Pessoas nas Organizações'),
  ('Gestão de Pessoas', 'Benefícios, saúde, segurança e qualidade de vida', 'Gestão de Pessoas', 'Qualidade de vida no trabalho');

do $$
declare
  item record;
  objetivo_bacen uuid;
  old_id uuid;
  old_materia_id uuid;
  new_id uuid;
  new_materia_id uuid;
begin
  select id into objetivo_bacen from objetivo where tipo = 'concurso' and ativo = true order by criado_em limit 1;
  for item in select * from mapa_topicos_bacen loop
    select t.id, m.id into old_id, old_materia_id
    from topico t join materia m on m.id = t.materia_id
    where m.objetivo_id = objetivo_bacen and m.nome = item.materia_antiga and t.nome = item.topico_antigo;
    if old_id is null then continue; end if;

    select t.id, m.id into new_id, new_materia_id
    from topico t join materia m on m.id = t.materia_id
    where m.objetivo_id = objetivo_bacen and m.nome = item.materia_nova and t.nome = item.topico_novo;
    if new_id is null then raise exception 'Tópico de destino ausente: % / %', item.materia_nova, item.topico_novo; end if;
    if old_id = new_id then continue; end if;

    delete from questao old_q using questao new_q
    where old_q.topico_id = old_id and new_q.topico_id = new_id
      and old_q.ativa = true and new_q.ativa = true
      and md5(lower(old_q.enunciado)) = md5(lower(new_q.enunciado));
    update questao set topico_id = new_id where topico_id = old_id;
    update question_card set topico_id = new_id, materia_id = new_materia_id where topico_id = old_id;
    update conhecimento set topico_id = new_id, materia_id = new_materia_id where topico_id = old_id;
    update sessao set topico_id = new_id, materia_id = new_materia_id where topico_id = old_id;
    update seeding_job set topico_id = new_id where topico_id = old_id;
    update mentor_decisao set topico_id = new_id where topico_id = old_id;
    delete from acervo_meta where topico_id = old_id;
    delete from topico where id = old_id;
  end loop;
end $$;

-- Remove apenas os tópicos do BACEN que não constam na lista confirmada.
delete from topico t
using materia m, objetivo o
where t.materia_id = m.id and m.objetivo_id = o.id and o.tipo = 'concurso' and o.ativo = true
  and not exists (
    select 1 from catalogo_bacen_desejado d where d.materia = m.nome and d.topico = t.nome
  );

-- O material administrativo agregado antigo é preservado sob Administração Pública.
update material mat
set materia_id = destino.id
from materia antiga
join objetivo o on o.id = antiga.objetivo_id and o.tipo = 'concurso' and o.ativo = true
join materia destino on destino.objetivo_id = o.id and destino.nome = 'Administração Pública'
where mat.materia_id = antiga.id and antiga.nome = 'Gestão Pública e Ética';

update sessao s
set materia_id = destino.id
from materia antiga
join objetivo o on o.id = antiga.objetivo_id and o.tipo = 'concurso' and o.ativo = true
join materia destino on destino.objetivo_id = o.id and destino.nome = 'Administração Pública'
where s.materia_id = antiga.id and antiga.nome = 'Gestão Pública e Ética';

update compromisso c
set materia_id = destino.id
from materia antiga
join objetivo o on o.id = antiga.objetivo_id and o.tipo = 'concurso' and o.ativo = true
join materia destino on destino.objetivo_id = o.id and destino.nome = 'Administração Pública'
where c.materia_id = antiga.id and antiga.nome = 'Gestão Pública e Ética';

update simulado s
set materia_id = destino.id
from materia antiga
join objetivo o on o.id = antiga.objetivo_id and o.tipo = 'concurso' and o.ativo = true
join materia destino on destino.objetivo_id = o.id and destino.nome = 'Administração Pública'
where s.materia_id = antiga.id and antiga.nome = 'Gestão Pública e Ética';

-- Remove disciplinas BACEN que não pertencem ao catálogo. A faculdade permanece intacta.
delete from materia m
using objetivo o
where m.objetivo_id = o.id and o.tipo = 'concurso' and o.ativo = true
  and not exists (select 1 from catalogo_bacen_desejado d where d.materia = m.nome);

insert into acervo_meta (topico_id, questoes_alvo, cards_alvo, expansao_bloqueada, motivo_bloqueio)
select t.id, 30, 50, false, null
from topico t
join materia m on m.id = t.materia_id
join objetivo o on o.id = m.objetivo_id
where o.tipo = 'concurso' and o.ativo = true
on conflict (topico_id) do update set
  questoes_alvo = 30,
  cards_alvo = 50,
  expansao_bloqueada = false,
  motivo_bloqueio = null,
  atualizado_em = now();

do $$
declare
  total_materias integer;
  total_topicos integer;
  total_extras integer;
begin
  select count(*) into total_materias
  from materia m join objetivo o on o.id = m.objetivo_id
  where o.tipo = 'concurso' and o.ativo = true;
  select count(*) into total_topicos
  from topico t join materia m on m.id = t.materia_id join objetivo o on o.id = m.objetivo_id
  where o.tipo = 'concurso' and o.ativo = true;
  select count(*) into total_extras
  from topico t join materia m on m.id = t.materia_id join objetivo o on o.id = m.objetivo_id
  where o.tipo = 'concurso' and o.ativo = true
    and not exists (select 1 from catalogo_bacen_desejado d where d.materia = m.nome and d.topico = t.nome);
  if total_materias <> 12 or total_topicos <> 71 or total_extras <> 0 then
    raise exception 'Catálogo BACEN inválido: % disciplinas, % tópicos e % extras.', total_materias, total_topicos, total_extras;
  end if;
end $$;

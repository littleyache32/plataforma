-- Reclassifica itens de tópicos legados amplos para os tópicos específicos do catálogo confirmado.

create temporary table regras_reclassificacao_bacen (
  ordem integer not null,
  materia_origem text not null,
  topico_origem text not null,
  materia_destino text not null,
  topico_destino text not null,
  padrao text not null
) on commit drop;

insert into regras_reclassificacao_bacen values
  (1, 'Direito Constitucional', 'Direitos Individuais', 'Direito Constitucional', 'Direitos Individuais - Remédios Constitucionais e Garantias Processuais', '(habeas corpus|habeas data|mandado de segurança|mandado de injunção|ação popular|remédio constitucional|garantia processual)'),
  (2, 'Direito Constitucional', 'Direitos Individuais', 'Direito Constitucional', 'Teoria dos Direitos Fundamentais', '(teoria dos direitos fundamentais|dimensões? dos direitos fundamentais|gerações? dos direitos fundamentais)'),
  (3, 'Direito Constitucional', 'Princípios Fundamentais da República', 'Direito Constitucional', 'Teoria da Constituição', '(conceito de constituição|classificação das constituições|poder constituinte|constituição formal|constituição material)'),
  (4, 'Direito Constitucional', 'Organização dos Poderes', 'Direito Constitucional', 'Organização do Poder Judiciário', '(superior tribunal de justiça|tribunal regional federal|tribunal regional do trabalho|tribunal regional eleitoral|justiça militar|conselho nacional de justiça|\mcnj\M|supremo tribunal federal|\mstf\M|\mstj\M)'),
  (5, 'Direito Constitucional', 'Organização dos Poderes', 'Direito Constitucional', 'Poder Legislativo', '(poder legislativo|congresso nacional|câmara dos deputados|senado federal|parlamentar|comissão parlamentar|tribunal de contas|\mtcu\M)'),
  (6, 'Direito Constitucional', 'Organização dos Poderes', 'Direito Constitucional', 'Poder Executivo', '(poder executivo|presidente da república|vice-presidente|ministro de estado|impeachment|conselho da república|conselho de defesa nacional)'),
  (7, 'Direito Constitucional', 'Organização dos Poderes', 'Direito Constitucional', 'Poder Judiciário', '(poder judiciário|magistrad|garantia dos juízes|quinto constitucional)'),
  (8, 'Português', 'Morfologia', 'Português', 'Morfologia - Verbos', '(\mverbo|verbal|pretérito|particípio|gerúndio|infinitivo|conjugação)'),
  (9, 'Português', 'Morfologia', 'Português', 'Morfologia - Pronomes', '(\mpronome|pronominal|colocação pronominal|próclise|mesóclise|ênclise)'),
  (10, 'Noções de Informática', 'Internet', 'Noções de Informática', 'Navegadores (Browser)', '(navegador|browser|google chrome|mozilla firefox|internet explorer)'),
  (11, 'Noções de Informática', 'Internet', 'Noções de Informática', 'Redes de Computadores', '(rede de computadores|topologia de rede|roteador|switch|protocolo tcp|endereço ip|\mlan\M|\mwan\M)'),
  (12, 'Contabilidade Geral', 'Outras Demonstrações', 'Contabilidade Geral', 'Demonstração dos Fluxos de Caixa - DFC', '(fluxos? de caixa|\mdfc\M)'),
  (13, 'Contabilidade Geral', 'Outras Demonstrações', 'Contabilidade Geral', 'Demonstração do Valor Adicionado - DVA', '(valor adicionado|\mdva\M)'),
  (14, 'Gestão de Pessoas', 'Qualidade de vida no trabalho', 'Gestão de Pessoas', 'Remuneração e Benefícios', '(remuneração|benefício|salário|recompensa financeira)'),
  (15, 'Arquivologia', 'Gestão de Documentos / Arquivos Corrente e Intermediário', 'Arquivologia', 'Conceitos Fundamentais', '(conceito de arquivologia|definição de arquivo|conceitos? fundamentais|princípio da proveniência|teoria das três idades)'),
  (16, 'Administração Pública', 'Organização e Estrutura do Estado, Governo e Administração', 'Administração Pública', 'Gestão de Políticas Públicas', '(política pública|políticas públicas|formulação de políticas|ciclo de políticas)'),
  (17, 'Administração Pública', 'Organização e Estrutura do Estado, Governo e Administração', 'Administração Pública', 'Modelos teóricos de Administração Pública', '(administração patrimonialista|administração burocrática|modelo burocrático|modelo gerencial|pós-burocrático)');

do $$
declare
  regra record;
  objetivo_bacen uuid;
  origem_id uuid;
  destino_id uuid;
  destino_materia_id uuid;
begin
  select id into objetivo_bacen from objetivo where tipo = 'concurso' and ativo = true order by criado_em limit 1;
  for regra in select * from regras_reclassificacao_bacen order by ordem loop
    select t.id into origem_id
    from topico t join materia m on m.id = t.materia_id
    where m.objetivo_id = objetivo_bacen and m.nome = regra.materia_origem and t.nome = regra.topico_origem;
    select t.id, m.id into destino_id, destino_materia_id
    from topico t join materia m on m.id = t.materia_id
    where m.objetivo_id = objetivo_bacen and m.nome = regra.materia_destino and t.nome = regra.topico_destino;
    if origem_id is null or destino_id is null then
      raise exception 'Origem ou destino ausente na reclassificação %.', regra.ordem;
    end if;

    delete from questao antiga using questao existente
    where antiga.topico_id = origem_id and existente.topico_id = destino_id
      and antiga.ativa = true and existente.ativa = true
      and md5(lower(antiga.enunciado)) = md5(lower(existente.enunciado))
      and lower(concat_ws(' ', antiga.enunciado, antiga.explicacao, antiga.trecho_fonte)) ~ regra.padrao;

    update questao
    set topico_id = destino_id
    where topico_id = origem_id
      and lower(concat_ws(' ', enunciado, explicacao, trecho_fonte)) ~ regra.padrao;

    update question_card
    set topico_id = destino_id, materia_id = destino_materia_id
    where topico_id = origem_id
      and lower(concat_ws(' ', frente, verso, trecho_fonte)) ~ regra.padrao;
  end loop;
end $$;

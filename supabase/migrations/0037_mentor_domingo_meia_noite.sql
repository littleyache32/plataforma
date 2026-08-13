update conhecimento_modulo
set conteudo = jsonb_set(conteudo, '{politica,criacao_semanal}', '{"dia":"domingo","horario_brasilia":"00:00","fallback":"abertura_do_aplicativo_no_domingo_ou_segunda"}'::jsonb),
    atualizado_em = now()
where modulo = 'mentor' and ativo = true;

update mentor_conhecimento
set politica = jsonb_set(politica, '{criacao_semanal}', '{"dia":"domingo","horario_brasilia":"00:00","fallback":"abertura_do_aplicativo_no_domingo_ou_segunda"}'::jsonb)
where ativo = true;

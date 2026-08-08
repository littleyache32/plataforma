update acervo_meta
set questoes_alvo=20,
    cards_alvo=20,
    atualizado_em=now();

update mentor_conhecimento
set politica=politica || '{"fase_iniciante":{"inicio":"2026-08-10","fim":"2026-08-23","minutos_dia":180,"faculdade_minutos":60,"bacen_minutos":120,"somente_estudo":true,"questoes":false,"question_cards":false,"revisao":false},"transicao_pos_iniciante":"introducao_gradual_por_evidencia"}'::jsonb,
    evidencias=evidencias || '[{"principio":"instrucao_para_iniciantes","fonte":"Renkl et al., 2010","doi":"10.1016/j.cedpsych.2010.10.004"},{"principio":"exemplos_antes_de_problemas_complexos","fonte":"Retnowati et al., 2020","pmid":"31465546"},{"principio":"espacamento_e_transicao_para_recuperacao","fonte":"IES Practice Guide","url":"https://ies.ed.gov/ncee/wwc/PracticeGuide/1"},{"principio":"recuperacao_apos_estudo","fonte":"Pastotter e Bauml, 2014","pmid":"24772101"}]'::jsonb
where versao='2026.08.2';

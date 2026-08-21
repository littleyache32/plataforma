-- Reinicio do banco de questoes solicitado em 21/08/2026.
-- Preserva Question Cards, materiais, conhecimento, catalogo, tempo e planejamento.

begin;

delete from simulado_item;
delete from questao;

commit;

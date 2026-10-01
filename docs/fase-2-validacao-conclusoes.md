# Fase 2: auditoria de conclusões e calendário

Data da leitura do Supabase: 30/09/2026. Consulta somente de leitura; nenhum progresso foi apagado ou reiniciado.

## Estado real dos materiais

- PDFs explicitamente concluídos: **0**.
- PDFs em andamento: **2**: Direito Administrativo, Aula 1, Atos Administrativos; Português, Aula 1, Ortografia e Acentuação.
- Sessões acadêmicas concluídas preservadas: **6**, todas de Teoria do Crime em 21/09/2026. Nenhuma aula presencial estava registrada como evento `tipo = aula`.
- Próximo PDF elegível por disciplina: Aula 1 de cada um dos 11 pacotes atuais. Em Direito Administrativo e Português, a Aula 1 permanece em andamento; concluir o bloco não a faz avançar.

| Disciplina | Próximo PDF |
| --- | --- |
| Administração de Materiais | 1. Administração de Recursos Materiais |
| Arquivologia | 1. Conceitos Fundamentais de Arquivologia |
| Direito Administrativo | 1. Atos Administrativos, em andamento |
| Direito Constitucional | 1. Teoria Geral da Constituição |
| Ética Profissional | 1. Ética, Moral, Valores e Virtudes e Ética no Serviço Público |
| Fundamentos de Contabilidade | 1. Aspectos Introdutórios |
| Gestão de Pessoas | 1. Conceitos Introdutórios. Modelos Teóricos de Administração Pública |
| Gestão Pública | 1. Conceitos introdutórios |
| Informática | 1. Redes de Computadores, Parte 1, Noções Iniciais |
| Português | 1. Ortografia e Acentuação, em andamento |
| Raciocínio Lógico | 1. Estruturas Lógicas |

## Duplicidade

Demandas ativas com a mesma `chave_mentor`: **0**. Demandas planejadas repetidas por `material_id`, data, modalidade e ordem: **0**. Não havia duplicidade real a apagar. O risco técnico era recriar uma necessidade com chave diferente e confundir dois blocos legítimos do mesmo PDF; a verificação de equivalência considera material, finalidade, data e ordem, além da chave estável.

## Simulação do novo ciclo

| Datas | Plano diário | Estudo líquido | Teto no sábado | Teto no domingo |
| --- | --- | --- | --- | --- |
| 02/10 a 08/10 | 2 BACEN + 1 Faculdade | 150 min | 5 blocos, plano de 3 | 4 blocos, plano de 3 |
| 09/10 a 15/10 | 3 BACEN + 1 Faculdade | 200 min | 5 blocos, plano de 4 | 4 blocos, plano de 4 |

Sexta, sábado e domingo mantêm um bloco acadêmico como **Estudo**, sem fingir aula presencial. Segunda a quinta só identificam a aula ministrada se houver registro real ainda não estudado; sem registro, apresentam Estudo genérico. Prova próxima muda a disciplina acadêmica, não adiciona bloco. Faltas não elevam os blocos do fim de semana.

Validação final: 122 testes, lint e build passaram. A migration 0065 foi aplicada e confirmada. O commit de código `44d319a` chegou à produção; a Semana autenticada exibiu 02, 03 e 04/10 com três blocos de 50 minutos e título acadêmico genérico. Após a correção restrita dos três títulos já persistidos, restaram zero títulos de aula fictícia e zero duplicidades ativas nesses dias. A consulta de erros da Vercel não encontrou falhas na última hora. A semana futura de 09 a 15/10 foi simulada em teste, sem antecipar o cron.

## Regra canônica

`material_progresso.estado = concluido` com `concluido_em` válido determina conclusão. Uma sessão de estudo feita deixa o material `em_andamento`, não concluído. Um material concluído sai da trilha normal mesmo se a conclusão ocorreu antes de 02/10. Sem PDF elegível, o planner não volta ao catálogo antigo. Revisão futura exige demanda com modalidade e motivo de revisão.

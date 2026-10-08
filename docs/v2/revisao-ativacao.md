# Fase 4.18: preflight e procedimento de ativação

Data: 08/10/2026. Checkpoint funcional inspecionado: `2755eca4c9674d686052f26e088b8968d0d2ebc7`, branch `v2`.

## Estado e limites

Ativação NÃO autorizada por este relatório. Nenhuma migration, escrita de produção, merge ou deploy executado. A inspeção real usou conexão PostgreSQL com `default_transaction_read_only=on`, transação `REPEATABLE READ READ ONLY` e rollback. O script `scripts/audit-review-schema-readonly.js` verifica a correspondência entre o projeto Supabase configurado e a conexão antes de consultar schema, constraints, índices, ledger e contagens agregadas. Não imprime credenciais nem conteúdo pessoal.

O projeto configurado corresponde a `uozowehkkkqjmsagiyig`. PostgreSQL real: 17.6. Ledger contém migrations até 0068; a nova 0069 não está aplicada. Foram observadas 10 sessões concluídas, 114 unidades curriculares, zero tentativas e zero necessidades de revisão. As contagens não substituem backup e não demonstram segurança de escrita.

Não há PostgreSQL local, Docker, Supabase local ou CLI GitHub disponível. Foi solicitada autorização para CI efêmero, condicionada à confirmação de que a branch de testes não dispara deploy. Sem essa autorização e confirmação, não publicar branch nem executar CI. Não usar produção como alternativa.

## Conferência da 0069

`0069_revisao_v2_fatos_sem_intervalo.sql` é aditiva: remove obrigatoriedade/default de `agendada_para`; adiciona JSON de metadados, vínculos UUID opcionais e identificador de conceito; cria índice por necessidade/data. As tabelas, colunas e chaves referenciadas existem no schema real. Os registros antigos mantêm datas existentes e recebem vínculos nulos; o JSON novo tem default vazio. Não há UPDATE de histórico, DELETE, TRUNCATE ou DROP de tabela. As novas FKs usam NO ACTION, portanto podem bloquear exclusões futuras de registros referenciados; não contornar isso apagando história.

Não há outra 0069 no diretório canônico da V2 nem no ledger real. A branch separada `test/fase-7-postgres` contém `0069_tempo_sessao_duracao_atomica.sql`, uma migration de outra linha de desenvolvimento. Não importar nem aplicar as duas sob a mesma numeração. Se essa mudança for futuramente reaproveitada, escolher nova numeração canônica naquele momento. Duplicações históricas de numeração já aplicadas não devem ser renumeradas nesta fase.

**Bloqueio identificado por inspeção:** a 0069 contém BEGIN/COMMIT internos, enquanto `scripts/migrate.js` já envolve SQL e inserção no ledger em uma transação. O COMMIT interno separa DDL do registro de aplicação. Uma falha posterior no ledger pode deixar schema aplicado sem controle de reaplicação, e os ADD COLUMN não são repetíveis diretamente. Antes de ativar, reproduzir em PostgreSQL isolado e corrigir minimamente o limite transacional, mantendo schema e ledger na mesma transação. Não foi alterada a migration sem a validação isolada solicitada.

Os handlers V2 leem as novas colunas: código e schema precisam ser ativados coordenadamente. Caches, inserção de tentativa e atendimento da necessidade ainda são chamadas separadas. Índices únicos de operação e necessidade pendente oferecem proteção de duplicidade, mas não provam atomicidade do fluxo inteiro. Retry controlado e concorrência real ainda precisam ser exercitados; não atribuir essa garantia aos mocks.

## Validação isolada pendente

Usar PostgreSQL 17 efêmero, banco exclusivamente sintético e credenciais exclusivas de teste. Proibir URL/ambiente Supabase de produção no job. Preparar dependências pelo DDL real pertinente e validar a 0069 junto ao ledger canônico.

Comprovar: aplicação; preservação de linhas legadas com datas; nova necessidade sem data default; persistência e FKs tentativa/necessidade/demanda/erro-alvo/tópico; rollback de falha de FK e de falha entre DDL e ledger; reaplicação controlada pelo ledger; duas conexões simultâneas com mesmo operation ID; duas criações simultâneas de necessidade pendente; retry após falha intermediária do fluxo de tentativa/atendimento. Verificar dados persistidos depois de cada caso. Mock não comprova rollback ou concorrência PostgreSQL.

Fluxo autenticado deve usar ambiente seguro com usuário sintético e autorização real, incluindo recusa de usuário incorreto. Os testes atuais de integração substituem `requireAccess`; não representam autenticação real de ponta a ponta. Não registrar tentativa ou encontro no banco real para preencher esta lacuna.

## Procedimento de aplicação futura, somente após autorização

1. Encerrar validação isolada, corrigir o limite transacional e conferir SHA exato do código/migration. Confirmar ausência de outras migrations pendentes e impedir dois executores simultâneos.
2. Fazer backup verificável do schema e dados essenciais, incluindo ledger, questões, tentativas, necessidades, sessões, decisões e unidades/progresso. Guardar fora do Git, de forma privada e protegida. Registrar ponto de recuperação e testar restauração em banco isolado. Nenhum backup de dados reais foi criado nesta etapa.
3. Repetir preflight somente leitura, comparar dependências/constraints, ledger e contagens. Não aplicar arquivos da branch antiga. Manter prática desativada durante a janela de alinhamento.
4. Executar a migration corrigida e o registro no ledger dentro de UMA transação controlada pelo executor. Em erro, rollback integral. Não executar SQL avulso sem controle de aplicação.
5. Antes de liberar uso, verificar colunas/FKs/índice, datas legadas preservadas, contagens e registro único no ledger; alinhar código compatível sob autorização separada de publicação.
6. Em falha antes do commit, rollback. Depois do commit, preservar schema aditivo e fatos novos; não remover colunas nem apagar registros para voltar versão. Reverter publicação somente para código compatível; restauração de backup exige autorização explícita, avaliação dos fatos posteriores e validação isolada.

TLS do preflight segue a configuração existente do executor com CA não verificada. Isso não altera produção, mas é um débito de transporte a considerar antes da ativação. Não registrar URL/senha/token em logs, documentos, commits ou outputs.

## Resultado

Compatibilidade estática e leitura real do schema: verificadas. Escrita PostgreSQL isolada, concorrência/rollback e E2E autenticado seguro: pendentes. Nenhuma alteração funcional ou correção de migration realizada. Não aplicar 0069 em produção enquanto os bloqueios acima permanecerem.

Validação local: 101 testes direcionados aprovados (integração, Central, método e reteste); suíte completa executada uma vez, 734 testes em 51 arquivos, todos aprovados. Lint/build do checkpoint anterior continuam como resultados anteriores, não foram repetidos. O novo script de diagnóstico foi executado com sucesso em conexão estritamente read-only; nenhum handler foi modificado. Arquivos locais preexistentes, outputs e ZIP privado não fazem parte deste checkpoint.

## Fase 4.19: correção local e bloqueio antes do push

08/10/2026: o controle transacional foi conferido no executor. A 0069 deixa de emitir BEGIN/COMMIT próprios e passa a manter todo DDL na transação que também grava o ledger. O executor adquire advisory transaction lock e reconsulta o ledger depois desse lock; outro executor que aguardou não tenta reaplicar uma migration já confirmada. Essa correção não modifica outras migrations históricas nem garante retroativamente sua atomicidade caso contenham controle transacional interno. Aplicação avulsa da 0069 continua proibida.

Testes estruturais novos verificam ausência de comandos transacionais internos, ausência de reescrita histórica, retirada do default de data e ordem lock/ledger/DDL/registro/commit. Não são provas de rollback ou concorrência PostgreSQL. 49 testes direcionados passaram; a suíte completa executada uma vez aprovou 738 testes em 52 arquivos. Lint aprovou 180 arquivos. Build não repetido: nenhuma mudança em frontend, handlers ou grafo de bundle.

O usuário autorizou branch temporária e CI PostgreSQL 17 sem credenciais reais, com condição explícita de confirmar antes do push que nenhum Preview ou produção será disparado. A consulta read-only ao projeto Vercel correto identificou o projeto, mas não expôs configuração Git/deploy por branch. Não foi possível garantir a condição. Nenhum push, branch remota de homologação, workflow ou deploy foi disparado. É necessário obter evidência da desativação de deploy para a branch de homologação antes de prosseguir. Não alterar configuração remota silenciosamente.

Homologação do schema até 0068, escrita da 0069, rollback, concorrência, idempotência e histórico em PostgreSQL 17 continuam pendentes. Fluxo autenticado conectado ao banco isolado também continua pendente. A aplicação atual é pessoal e permite somente uma conta; teste de autorização precisa comprovar acesso dessa conta e recusa de acesso inválido, sem criar arquitetura multiusuário para preencher este requisito. Não foram alterados carga, calendário, distribuição, início do ciclo, limites ou dívida da Fase 3.17.

Resultado da 4.19 até este checkpoint: correção local versionável, homologação bloqueada antes do push. Não aplicar em produção nem encerrar a Fase 4.

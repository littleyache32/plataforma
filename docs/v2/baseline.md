# Baseline técnico da Plataforma V2

## Identificação

- Fase: 0.5, fechamento da preparação da V2.
- Data da execução: 06/10/2026, horário de Brasília.
- Branch: `v2`.
- SHA validado: `bc36d01333ad94580704cbebf81872046605f8b8`.
- Estado: **PASS COM LIMITAÇÕES**.
- Escopo: dependências, suíte atual, lint, build e smoke local do frontend compilado. Sem novas funcionalidades, migrations, alteração de dados, push ou deploy.
- Este relatório foi criado após as verificações e não está incluído no SHA validado. Nenhum novo commit foi solicitado nesta subfase.

## Dependências

Node.js `v26.4.0`; npm `11.17.0`. O requisito do projeto é Node >=24.

`npm ls --depth=0` terminou com código 0. As 10 dependências diretas instaladas coincidem com suas versões em `package-lock.json`, sem divergências. Não foi necessário reinstalar ou atualizar dependências; package.json e lockfile permanecem intactos. Não foi feita auditoria de vulnerabilidades nem reinstalação limpa por npm ci.

| dependência | versão instalada e no lockfile |
| --- | --- |
| @google/genai | 1.52.0 |
| @napi-rs/canvas | 0.1.80 |
| @supabase/supabase-js | 2.112.2 |
| pdf-parse | 2.4.5 |
| pg | 8.22.0 |
| react / react-dom | 19.2.8 |
| @vitejs/plugin-react | 5.2.0 |
| vite | 7.3.6 |
| vitest | 3.2.7 |

## Verificações executadas

| verificação | comando/evidência | resultado |
| --- | --- | --- |
| Suíte atual completa | npm test, Vitest 3.2.7 | PASS: 22 arquivos, 164 testes aprovados; duração reportada 6,12 s; código 0. |
| Lint atual do projeto | npm run lint | PASS: 118 arquivos verificados, nenhum problema estrutural; código 0. |
| Build | npm run build, Vite 7.3.6 | PASS: 49 módulos transformados, build em 1,65 s; código 0. |
| Inicialização local | npm run preview -- --host 127.0.0.1 --port 4178 --strictPort --configLoader runner | PASS: frontend compilado servido e tela de acesso renderizada no navegador. |
| Console do smoke local | Leitura de logs error/warn da aba local | Nenhum erro ou aviso capturado. Não equivale a testar todas as áreas autenticadas. |
| Artefatos principais | HTML inicial e todos os 11 arquivos de dist/assets consultados no preview | Todos HTTP 200. Build inclui Home, StudyTime, FocusTimer, Questions, QuestionCards, ReviewCenter, Performance, Simulations e DiscursiveQuestions, além do shell com Week/Mentor/Layout. |
| Autenticação estrutural | tests/auth.test.js na suíte completa e inspeção de api/auth.js / AccessGate / App | PASS no escopo estrutural: token assinado válido, adulterado/expirado recusado e fingerprint anonimizado; contratos GET/POST/DELETE e login pessoal preservados. |
| Ausência de alteração funcional pela limpeza | git diff entre 801abb958eb9aecc77a89a2196f696c588763938 e SHA validado nos diretórios de código, testes, migrations e configs | Nenhuma diferença nesses arquivos. A limpeza 0.4 foi documental. |

As áreas principais foram comprovadas quanto a compilação e disponibilidade de seus assets. Não se declara navegação autenticada completa nem integração API/banco validada.

## Falhas, classificação e tratamento

Não houve falhas de testes, lint ou build, nem regressão confirmada introduzida pela Fase 0. Não foi necessária correção de código.

A primeira tentativa de `npm run preview` com o carregador padrão falhou porque o esbuild não pôde ler diretórios ancestrais dentro deste ambiente restrito. O comando foi repetido com `--configLoader runner`, o mesmo tipo de carregador já utilizado nos comandos de testes/build, e inicializou normalmente. Trata-se de limitação do ambiente/carregador, não de falha causada pela movimentação documental. Nenhum script ou configuração foi alterado para contorná-la.

O preview serve apenas o frontend, não as funções serverless. A tela de acesso renderizada não comprova login bem-sucedido: o App pode cair nesse estado quando a API não está disponível. Não foram informadas credenciais, criada conta, iniciada sessão real de estudo ou conectadas APIs ao Supabase. Ausência de conexão de integração isolada é limitação de validação, não bug confirmado.

## Débitos V1 preservados

Referência: [inventário aprovado](inventario-v1.md). Estes pontos permanecem para fases próprias, sem correção automática:

1. Defaults/caminhos históricos do Mentor podem recolocar políticas removidas do JSON modular; conhecimento, contexto, datas e limiares possuem representações concorrentes a consolidar.
2. Gates históricos de prática e elegibilidade de simulado coexistem com flags explícitas. Não reativar prática por data antiga.
3. Scripts de geração conservam metas/catálogos superados. Alguns comandos chamados audit também alteram dados; não foram executados.
4. Melhorias recentes de timer, duração, atomicidade, timezone, descanso, alertas e fila offline estão preservadas no snapshot da Fase 7, mas não integralmente incorporadas à v2 atual. A migration 0069 e seus testes PostgreSQL também permanecem fora deste checkout.
5. CSS sobreposto, caches PWA e fluxos offline exigem remodelagem dirigida futura, sem declarar comportamento real corrigido apenas porque a suíte passou.
6. Aplicação real das migrations, registros ativos de conhecimento/contexto, Storage, variáveis e produção não foram revalidados. As 69 migrations atuais foram preservadas.
7. O lint existente é uma verificação estrutural própria, não uma auditoria completa de hooks, acessibilidade, segurança ou qualidade da aplicação.

## Estado inicial da V2 e preservação Git

- Snapshot principal V1/Fase 7: `archive/v1-fase7-wip`, SHA `0dc19012bfc49e0dbdf3e8eb024552e33b3b30af`.
- Snapshot adicional do estado local V1: `archive/v1-local-pre-v2`, SHA `41f35484f61ce387153e2fc61ca2f5f0779f1f09`.
- Branches locais presentes: `main`, `v2`, `test/fase-7-postgres`, `archive/v1-fase7-wip`, `archive/v1-local-pre-v2`.
- Refs remotas conhecidas localmente: `origin/main`, `origin/v2`, `origin/test/fase-7-postgres`, `origin/archive/v1-fase7-2026-10-06`, `origin/archive/v1-main-2026-10-06`. Sem fetch/push nesta fase; essa lista não é nova consulta ao servidor.
- Arquivos removidos na Fase 0.4: nenhum.
- Documentos arquivados em docs/archive-v1: memoria-operacional-v1.md, auditoria-acervo-2026-08-10.md, fase-2-validacao-conclusoes.md, mentor-fase-1-consolidacao.md e roteiro-consolidado-mentor.md. Conteúdo original preservado.
- Artefatos locais já existentes em output/ e plataforma-estudos-auditoria.zip permanecem fora do commit e intactos. Builds/dependências continuam ignorados; dist foi regenerado pelo build autorizado.
- Nenhum código de aplicação, teste, migration ou contrato de configuração foi alterado nesta validação. Apenas este relatório e o registro da memória operacional foram adicionados/atualizados.

## Limites e saída

Baseline de desenvolvimento aprovado: pode iniciar a Fase 1 mediante instrução específica do usuário. Esta conclusão não autoriza publicação, merge de V1 ou uso de dados reais para testes. Login real, renderização de módulos autenticados com suas APIs e alinhamento com banco/produção continuam não comprovados nesta subfase.

A classificação PASS COM LIMITAÇÕES reflete esse limite explícito de integração, não falhas nas quatro verificações técnicas exigidas. A Fase 1 não foi iniciada.

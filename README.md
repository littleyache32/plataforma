# Mentor de Estudos

Plataforma pessoal de estudo para Faculdade de Direito e preparação para o BACEN. O mentor cria e recalibra demandas semanais simples usando execução, questões, Question Cards, revisões, prazos e tempo agregado.

## Estado atual

- Aplicação Vite + React em JavaScript, publicada na Vercel.
- Funções serverless em `/api` e persistência no Supabase.
- Acesso pessoal por cookie de sessão assinado.
- Um único modo de uso. Não existe painel Administrador na interface.
- Semana unificada com demandas de Faculdade e BACEN.
- Questões objetivas, caderno de revisão e Question Cards com repetição espaçada.
- Questões discursivas e simulados permanecem bloqueados.
- Timer associado a objetivo, disciplina, tópico e tipo de atividade.
- Mentor com resumo, alertas, progresso e encontro semanal.
- Gemini desativado. Nenhuma geração externa é executada.

## Política canônica do mentor

A política de fallback fica em `shared/mentor-policy.js` e a versão persistida fica no módulo `mentor` do Supabase. A versão atual é `2026.08.7`.

- O diagnóstico por tópico começa com 10 respostas. Nove respostas continuam como `coletando_dados`.
- Questões consideram resultado, confiança, falsa certeza e recência.
- Question Cards consideram novamente, difícil, bom, fácil, lapsos, vencimento, atraso e tendência. Cards complementam questões e não estabelecem domínio sozinhos.
- Tempo é analisado somente de forma agregada e comparável. Uma sessão isolada ou uma duração maior não causa punição nem encerra uma demanda.
- Peso da disciplina, incidência do tópico, revisões vencidas e compromissos próximos entram na prioridade.
- O encontro semanal aceita classificações opcionais. O texto livre serve como contexto humano e não altera o plano sozinho.
- Experimentos estão apenas preparados no banco. Não podem ser ativados automaticamente.
- Sono, energia e humor não existem na política nem no encontro.

## Planejamento

As demandas mostram somente o necessário para executar: atividade, disciplina ou tópico, tipo, duração estimada e prioridade. O mentor preserva a sequência dos conteúdos e decide carga, revisão, prática e retorno sem criar microtarefas.

Na fase inicial já definida, a carga e os bloqueios permanecem inalterados. Depois dessa fase, a carga pode ser mantida, aumentada ou reduzida conforme aderência confirmada, pendências e evidências acumuladas.

Compromissos acadêmicos podem ser ligados diretamente a tópicos. Quando não houver vínculo, `conteudo_previsto` funciona como fallback. Conteúdo novo gera estudo; conteúdo já estudado e fraco gera revisão ou questões; conteúdo dominado recebe manutenção.

## Instalação local

Requisitos: Node.js 24 ou superior e um projeto Supabase.

```bash
npm install
copy .env.example .env.local
npm run migrate
npm run dev:full
```

## Variáveis de ambiente

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APP_ACCESS_KEY
POSTGRES_URL_NON_POOLING ou POSTGRES_URL
CRON_SECRET
```

`GEMINI_API_KEY` pode permanecer configurada na infraestrutura, mas não é usada enquanto a proibição estiver ativa. Nunca use o prefixo `VITE_` para segredos e nunca envie `.env.local` ao GitHub.

## Banco e publicação

As migrações ficam em `supabase/migrations` e não são aplicadas automaticamente pela Vercel.

```bash
npm run migrate
npm test
npm run lint
npm run build
```

Depois da migração e das validações, o push na branch conectada publica a versão pela Vercel.

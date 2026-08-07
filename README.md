# Mentor de Estudos

Plataforma pessoal para Faculdade de Direito e preparação para o BACEN. O produto conecta plano semanal, questões, Question Cards, simulados e diagnóstico de desempenho.

## Funcionalidades

- Seletor lado a lado entre Faculdade e BACEN.
- Modos Aluno e Administrador.
- Início com próxima ação, atalhos e resumo da semana.
- Anamnese rápida e geração automática do plano.
- Metas semanais flexíveis, sem horários fixos.
- Questões por disciplina inteira ou tópico específico.
- Certeza, Dúvida, Eliminação e Sem conhecimento em toda resposta.
- Fila de revisão e detecção de falsa certeza.
- Question Cards com repetição espaçada.
- Simulados cronometrados, salvamento e retomada.
- Fontes e materiais restritos ao modo Administrador.
- Geração de questões com Gemini e fontes pesquisadas.

## Instalação local

Requisitos: Node.js 24 ou superior e um projeto Supabase.

```bash
npm install
cp .env.example .env.local
npm run migrate
npm run dev:full
```

O `vercel dev` executa o frontend e as funções da pasta `api` juntas.

## Variáveis de ambiente

Configure localmente e na Vercel:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
APP_ACCESS_KEY
GEMINI_MODEL
POSTGRES_URL_NON_POOLING ou POSTGRES_URL
```

Nunca use o prefixo `VITE_` para segredos e nunca envie `.env.local` ao GitHub.

## Banco de dados

As migrações ficam em `supabase/migrations` e são aplicadas em ordem pelo comando:

```bash
npm run migrate
```

A migração `0003_mentor_plano_cards_simulados.sql` cria a faculdade, a anamnese, o plano flexível, os Question Cards e os simulados. Migrações não são executadas automaticamente pela Vercel.

## Validação

```bash
npm run lint
npm test
npm run build
```

## Publicação

O projeto está preparado para Vercel. Quando o repositório estiver conectado, cada push na branch configurada gera uma nova publicação. Variáveis de ambiente e migrações devem estar configuradas separadamente.

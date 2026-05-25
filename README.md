# Bolao Copa 2026

Aplicacao de bolao da Copa do Mundo 2026 feita com Next.js App Router,
React 19, TypeScript e Supabase.

## Stack

- Next.js `app/` router
- React 19
- TypeScript
- Supabase Auth e Database
- Client components usando `lib/supabase.ts`

## Como rodar localmente

### 1. Instale as dependencias

```bash
npm install
```

### 2. Configure as variaveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_publica
```

Essas duas variaveis ficam disponiveis no browser porque o app usa o cliente
publico do Supabase em `lib/supabase.ts`.

Nao exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend. A aplicacao atual nao usa
essa chave para executar localmente.

### 3. Prepare o banco no Supabase

No painel do Supabase, abra o SQL Editor e execute os arquivos nesta ordem:

1. `supabase/schema.sql`
2. `supabase/schema_groups.sql`

O primeiro arquivo cria `players`, `games`, `bets`, policies de RLS, trigger de
criacao de perfil e dados iniciais de jogos. O segundo cria `groups`,
`group_members` e as funcoes usadas pelas telas de grupos:
`create_group`, `join_group` e `search_group_by_name`.

Se o banco ja existia antes das correcoes de integridade/RLS, execute tambem:

```text
supabase/fix_all_issues.sql
```

### 4. Configure Auth no Supabase

No Supabase, habilite login por email e senha.

Para desenvolvimento local, use uma destas opcoes:

- Desabilitar confirmacao obrigatoria de email.
- Confirmar manualmente os usuarios criados no painel do Supabase.

O app gera emails internos a partir do nome de usuario:

```text
usuario@bolao2026.app
```

### 5. Inicie o servidor local

```bash
npm run dev
```

Abra a URL exibida no terminal. Normalmente sera:

```text
http://localhost:3000
```

Se a porta 3000 estiver ocupada, o Next.js pode usar outra porta. Use sempre a
URL impressa pelo terminal.

## Debug quando a aplicacao nao abre

### O servidor nem inicia

Veja a mensagem exibida no terminal depois de `npm run dev`.

Confirme a versao do Node.js:

```bash
node -v
npm -v
```

Use Node.js 20 ou superior.

### A porta 3000 esta ocupada

No Windows, verifique a porta:

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
```

Para rodar em outra porta:

```bash
npx next dev -p 3001
```

Depois acesse:

```text
http://localhost:3001
```

### A pagina abre, mas mostra erro ao carregar dados

Verifique:

- `.env.local` existe na raiz do projeto.
- `NEXT_PUBLIC_SUPABASE_URL` esta correto.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` esta correto.
- O servidor foi reiniciado depois de alterar envs.
- As tabelas `players`, `games`, `bets`, `groups` e `group_members` existem.
- As policies de RLS foram criadas.
- A tabela `games` tem dados inseridos pelo `supabase/schema.sql`.
- O projeto Supabase esta ativo e acessivel pela rede.

## Comandos de verificacao

Lint:

```bash
npm run lint
```

Build de producao:

```bash
npm run build
```

Rodar o build localmente:

```bash
npm run start
```

O projeto ainda nao tem script de testes automatizados configurado. Hoje os
comandos disponiveis em `package.json` sao `dev`, `build`, `start` e `lint`.

## Setup de admin

1. Crie uma conta pela tela `/registro`.
2. No Supabase, abra a tabela `players`.
3. Altere `is_admin` para `true` no usuario desejado.
4. Acesse `/admin`.

## Pontuacao

- Placar exato: 3 pontos
- Vencedor ou empate correto: 1 ponto
- Resultado errado: 0 pontos

## Deploy na Vercel

1. Envie o repositorio para o GitHub.
2. Crie o projeto na Vercel.
3. Configure as envs:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Faca o deploy.

Veja `AGENTS.md` para detalhes de arquitetura e restricoes do projeto.

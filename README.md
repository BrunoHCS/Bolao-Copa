# ⚽ Bolão Copa 2026

Aplicação web para bolão da Copa do Mundo 2026 com seus amigos!

## 🎯 Funcionalidades
- Cadastro com nome de usuário e senha (sem e-mail)
- Palpites nos jogos antes de começarem
- Pontuação automática (3pts placar exato / 1pt resultado certo)
- Ranking em tempo real
- Painel admin para inserir resultados

## 🚀 Como publicar (passo a passo)

### 1. Criar conta no Supabase
1. Acesse supabase.com e crie uma conta grátis
2. Clique em "New project" e escolha um nome
3. Aguarde criar (~1 minuto)

### 2. Configurar o banco de dados
1. No Supabase, vá em **SQL Editor → New query**
2. Copie e cole o conteúdo de `supabase/schema.sql`
3. Clique em **Run** ✅

### 3. Pegar credenciais
1. No Supabase: **Settings → API**
2. Copie a **Project URL** e a **anon public key**

### 4. Publicar na Vercel
1. Suba o projeto para o GitHub
2. No vercel.com, clique em "Add New Project" e selecione o repositório
3. Adicione as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique em **Deploy** 🚀

### 5. Virar admin
1. Crie sua conta normalmente no site publicado
2. No Supabase → **Table Editor → players**
3. Edite seu usuário: mude `is_admin` para `true`

### 6. Compartilhar
Envie o link para os amigos! Cada um cria sua conta e já faz palpites.

## 📊 Pontuação
| Acerto | Pontos |
|---|---|
| Placar exato | 3 pts |
| Vencedor/Empate | 1 pt |
| Errou | 0 pts |

## 🛠️ Dev local
```bash
npm install
cp .env.local.example .env.local
# edite com suas credenciais
npm run dev
```

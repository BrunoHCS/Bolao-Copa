'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (username.length < 3) { setError('Nome de usuário deve ter ao menos 3 caracteres.'); return }
    if (password.length < 6) { setError('Senha deve ter ao menos 6 caracteres.'); return }
    if (!/^[a-z0-9_]+$/i.test(username)) { setError('Nome de usuário: use apenas letras, números e _'); return }

    setLoading(true)
    try {
      const email = `${username.toLowerCase().trim()}@bolao2026.app`

      // Criar usuário no Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password })
      if (authErr) {
        if (authErr.message.includes('already registered')) {
          setError('Este nome de usuário já está em uso.')
        } else {
          setError(authErr.message)
        }
        return
      }

      if (!authData.user) { setError('Erro ao criar conta.'); return }

      // Criar perfil do jogador
      const { error: profileErr } = await supabase.from('players').insert({
        id: authData.user.id,
        username: username.toLowerCase().trim(),
        display_name: displayName.trim(),
        is_admin: false,
        total_points: 0,
      })

      if (profileErr) {
        if (profileErr.message.includes('duplicate') || profileErr.code === '23505') {
          setError('Este nome de usuário já está em uso.')
        } else {
          setError('Erro ao criar perfil: ' + profileErr.message)
        }
        return
      }

      router.push('/palpites')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '420px', margin: '3rem auto' }} className="animate-fade-up">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span style={{ fontSize: '3rem' }}>🏆</span>
        <h1 className="font-display" style={{ fontSize: '2.5rem', marginTop: '0.5rem' }}>
          Entrar no <span className="trophy-gradient">Bolão</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Crie sua conta e comece a apostar!
        </p>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="font-ui" style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Seu nome (como vai aparecer no ranking)
            </label>
            <input
              className="input"
              type="text"
              placeholder="ex: João Silva"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              maxLength={40}
            />
          </div>

          <div>
            <label className="font-ui" style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Nome de usuário (para login)
            </label>
            <input
              className="input"
              type="text"
              placeholder="ex: joao123"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              required
              maxLength={20}
              autoComplete="username"
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
              Apenas letras, números e _. Não pode mudar depois.
            </p>
          </div>

          <div>
            <label className="font-ui" style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Senha
            </label>
            <input
              className="input"
              type="password"
              placeholder="mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--red)', fontSize: '0.9rem' }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" className="btn-gold" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
            {loading ? 'Criando conta...' : '🏆 Entrar no Bolão'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Já tem conta? </span>
          <Link href="/login" style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
            Entrar
          </Link>
        </div>
      </div>

      {/* Regras rápidas */}
      <div className="card" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
        <h3 className="font-ui" style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Como funciona a pontuação
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <ScoreRule pts="3 pts" desc="Placar exato! (ex: Brasil 2x1)" color="var(--gold)" />
          <ScoreRule pts="1 pt" desc="Acertou o vencedor ou empate" color="var(--green)" />
          <ScoreRule pts="0 pts" desc="Errou o resultado" color="var(--text-muted)" />
        </div>
      </div>
    </div>
  )
}

function ScoreRule({ pts, desc, color }: { pts: string; desc: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span className="font-display" style={{ fontSize: '1.1rem', color, minWidth: '50px' }}>{pts}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{desc}</span>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase, Player } from '@/lib/supabase'

export function Navbar() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        // Sessão corrompida ou inválida: faz signOut para limpar o localStorage
        if (sessionError) {
          console.warn('Sessão inválida detectada, limpando...', sessionError.message)
          await supabase.auth.signOut()
          setPlayer(null)
          return
        }

        if (session?.user) {
          const { data, error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (playerError) {
            // Usuário autenticado mas sem perfil — sessão inconsistente
            console.warn('Perfil não encontrado para sessão ativa, limpando...')
            await supabase.auth.signOut()
            setPlayer(null)
            return
          }

          if (data) setPlayer(data)
        }
      } catch (err) {
        console.error('Erro inesperado ao verificar sessão:', err)
        // Em caso de erro total, limpa a sessão para evitar loops
        try { await supabase.auth.signOut() } catch { /* ignora */ }
        setPlayer(null)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (error || !data) {
            setPlayer(null)
          } else {
            setPlayer(data)
          }
        } catch {
          setPlayer(null)
        }
      } else {
        setPlayer(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fecha o menu mobile ao navegar
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setPlayer(null)
    setMenuOpen(false)
    router.push('/')
  }

  return (
    <nav className="navbar" id="main-navbar">
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span className="font-display" style={{ fontSize: '1.6rem', color: 'var(--green)' }}>⚽ Bolão</span>
          <span className="font-display" style={{ fontSize: '1.6rem', color: 'var(--gold)' }}> Copa 2026</span>
        </Link>

        {/* Botão hambúrguer — só mobile */}
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          id="hamburger-toggle"
        >
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
        </button>

        {/* Links desktop + dropdown mobile */}
        <div className={`nav-links ${menuOpen ? 'nav-open' : ''}`} id="nav-links">
          <NavLink href="/" active={isActive('/')}>Ranking</NavLink>
          {player && <NavLink href="/palpites" active={isActive('/palpites')}>Palpites</NavLink>}
          {player && <NavLink href="/grupos" active={isActive('/grupos')}>Grupos</NavLink>}
          {player?.is_admin && <NavLink href="/admin" active={isActive('/admin')} gold>Admin</NavLink>}

          <div className="nav-divider" />

          {player ? (
            <div className="nav-user">
              <span className="font-ui" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {player.display_name}
              </span>
              <button onClick={handleLogout} className="btn-outline" style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}>
                Sair
              </button>
            </div>
          ) : (
            <div className="nav-auth">
              <Link
                href="/login"
                className="btn-outline"
                style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                className="btn-primary"
                style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Cadastrar
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

function NavLink({ href, active, gold, children }: { href: string; active: boolean; gold?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <span className="font-ui nav-link-item" style={{
        fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer',
        color: active ? (gold ? 'var(--gold)' : 'var(--green)') : 'var(--text-secondary)',
        borderBottom: active ? `2px solid ${gold ? 'var(--gold)' : 'var(--green)'}` : '2px solid transparent',
        transition: 'color 0.2s',
        display: 'inline-block',
      }}>
        {children}
      </span>
    </Link>
  )
}
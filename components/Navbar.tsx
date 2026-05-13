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
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase.from('players').select('*').eq('id', session.user.id).single()
        if (data) setPlayer(data)
      }
    }
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data } = await supabase.from('players').select('*').eq('id', session.user.id).single()
        if (data) setPlayer(data)
      } else {
        setPlayer(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close mobile menu on navigation
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

        {/* Hamburger button - mobile only */}
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

        {/* Desktop nav + Mobile dropdown */}
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
              <Link href="/login"><button className="btn-outline" style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}>Entrar</button></Link>
              <Link href="/registro"><button className="btn-primary" style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}>Cadastrar</button></Link>
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

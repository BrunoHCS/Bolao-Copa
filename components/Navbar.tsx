'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { player, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const closeMenu = () => setMenuOpen(false)

  const handleLogout = async () => {
    await signOut()
    setMenuOpen(false)
    router.push('/')
  }

  return (
    <nav className="navbar" id="main-navbar">
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <Link href="/" onClick={closeMenu} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span className="font-display" style={{ fontSize: '1.6rem', color: 'var(--green)' }}>⚽ Bolão</span>
          <span className="font-display" style={{ fontSize: '1.6rem', color: 'var(--gold)' }}> Copa 2026</span>
        </Link>

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

        <div className={`nav-links ${menuOpen ? 'nav-open' : ''}`} id="nav-links">
          <NavLink href="/" active={isActive('/')} onClick={closeMenu}>Ranking</NavLink>
          {player && <NavLink href="/palpites" active={isActive('/palpites')} onClick={closeMenu}>Palpites</NavLink>}
          {player && <NavLink href="/grupos" active={isActive('/grupos')} onClick={closeMenu}>Grupos</NavLink>}
          {player?.is_admin && <NavLink href="/admin" active={isActive('/admin')} onClick={closeMenu} gold>Admin</NavLink>}

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
                onClick={closeMenu}
                className="btn-outline"
                style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                onClick={closeMenu}
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

function NavLink({ href, active, gold, onClick, children }: { href: string; active: boolean; gold?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} style={{ textDecoration: 'none' }}>
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

'use client'

import './globals.css'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase, Player } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Script from "next/script";
import { Adsense } from "@/components/Adsense";

function Navbar({ player, onLogout }: { player: Player | null; onLogout: () => void }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href

  return (
    <nav className="navbar">
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span className="font-display" style={{ fontSize: '1.6rem', color: 'var(--green)' }}>⚽ Bolão</span>
          <span className="font-display" style={{ fontSize: '1.6rem', color: 'var(--gold)' }}> Copa 2026</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <NavLink href="/" active={isActive('/')}>Ranking</NavLink>
          {player && <NavLink href="/palpites" active={isActive('/palpites')}>Palpites</NavLink>}
          {player?.is_admin && <NavLink href="/admin" active={isActive('/admin')} gold>Admin</NavLink>}

          <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.5rem' }} />

          {player ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="font-ui" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {player.display_name}
              </span>
              <button onClick={onLogout} className="btn-outline" style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}>
                Sair
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
      <span className="font-ui" style={{
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null)
  const router = useRouter()

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setPlayer(null)
    router.push('/')
  }

  return (
    <html lang="pt-BR">
      <head>
        <title>Bolão Copa 2026</title>
        <meta name="description" content="Bolão da Copa do Mundo 2026!" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Script
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Navbar player={player} onLogout={handleLogout} />
        <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.25rem' }}>
          {children}
        </main>
        <footer style={{ borderTop: '1px solid var(--border)', marginTop: '4rem', padding: '2rem 1.25rem', textAlign: 'center' }}>
          <span className="font-ui" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
            ⚽ BOLÃO COPA 2026 — Boa sorte a todos! 🏆
          </span>
        </footer>
      </body>
    </html>
  )
}

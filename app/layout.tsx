import './globals.css'
import type { Metadata } from 'next'
import { Navbar } from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Bolão Copa 2026',
  description: 'Bolão da Copa do Mundo 2026! Faça seus palpites e dispute com os amigos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Navbar />
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
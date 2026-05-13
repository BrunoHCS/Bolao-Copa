'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '50vh', gap: '1.5rem', textAlign: 'center', padding: '2rem',
    }}>
      <div style={{ fontSize: '4rem' }}>😵</div>
      <h2 className="font-display" style={{ fontSize: '2rem', color: 'var(--text-primary)' }}>
        Algo deu errado!
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', fontSize: '0.95rem' }}>
        Ocorreu um erro inesperado. Tente novamente ou volte para a página inicial.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => unstable_retry()}
          className="btn-primary"
          style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}
        >
          ↻ Tentar novamente
        </button>
        <a href="/" style={{ textDecoration: 'none' }}>
          <button className="btn-outline" style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}>
            ← Página inicial
          </button>
        </a>
      </div>
      {error.digest && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
          Código: {error.digest}
        </p>
      )}
    </div>
  )
}

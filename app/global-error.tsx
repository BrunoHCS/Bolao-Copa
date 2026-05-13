'use client'

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="pt-BR">
      <body style={{
        backgroundColor: '#05090f',
        color: '#e8f0f8',
        fontFamily: "'Barlow', sans-serif",
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          maxWidth: '480px',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚽💥</div>
          <h1 style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: '2.5rem',
            letterSpacing: '0.05em',
            marginBottom: '0.5rem',
          }}>
            Erro Crítico
          </h1>
          <p style={{ color: '#7a9ab8', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Algo inesperado aconteceu na aplicação. Tente recarregar a página.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              background: '#00d64f',
              color: '#05090f',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ↻ Recarregar
          </button>
        </div>
      </body>
    </html>
  )
}

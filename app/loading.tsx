export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh',
      gap: '1rem',
    }}>
      <div style={{ fontSize: '3rem', animation: 'spin 1s linear infinite' }}>⚽</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <p className="font-ui" style={{
        color: 'var(--text-muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontSize: '0.9rem',
      }}>
        Carregando...
      </p>
    </div>
  )
}

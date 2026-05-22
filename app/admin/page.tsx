'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Player, Game } from '@/lib/supabase'
import { clearLocalAuthState, getCurrentSessionSafe, getPlayerForSessionSafe } from '@/lib/auth'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type SaveStatus = 'idle' | 'saving' | 'success' | 'error'

export default function AdminPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'results' | 'new-game'>('results')
  const router = useRouter()

  const [newGame, setNewGame] = useState({
    home_team: '', away_team: '', home_flag: '', away_flag: '',
    match_date: '', stage: 'Fase de Grupos',
  })
  const [addingGame, setAddingGame] = useState(false)
  const [gameMsg, setGameMsg] = useState('')

  const [results, setResults] = useState<Record<string, { home: string; away: string }>>({})
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const sessionResult = await getCurrentSessionSafe()
        if (!isMounted) return
        if (sessionResult.error || sessionResult.timedOut || !sessionResult.data) {
          if (sessionResult.error || sessionResult.timedOut) await clearLocalAuthState()
          setLoading(false)
          router.push('/login')
          return
        }

        const playerResult = await getPlayerForSessionSafe(sessionResult.data)
        if (!isMounted) return
        if (playerResult.error || !playerResult.data?.is_admin) {
          setLoading(false)
          router.push('/')
          return
        }

        setPlayer(playerResult.data)

        const { data: gamesData, error: gamesError } = await supabase
          .from('games').select('*').order('match_date', { ascending: true })
        if (!isMounted) return
        if (gamesError) { console.error('Erro ao carregar jogos:', gamesError); return }

        const gamesList = gamesData ?? []
        setGames(gamesList)

        const initResults: Record<string, { home: string; away: string }> = {}
        for (const g of gamesList) {
          initResults[g.id] = {
            home: g.home_score != null ? String(g.home_score) : '',
            away: g.away_score != null ? String(g.away_score) : '',
          }
        }
        setResults(initResults)
      } catch (err) {
        console.error('Erro inesperado ao carregar admin:', err)
        if (isMounted) router.push('/')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [router])

  const handleSaveResult = async (game: Game) => {
    const r = results[game.id]
    if (!r || r.home === '' || r.away === '') return

    // Limpa estado anterior deste jogo
    setSaveStatus(prev => ({ ...prev, [game.id]: 'saving' }))
    setSaveErrors(prev => ({ ...prev, [game.id]: '' }))

    try {
      const homeScore = parseInt(r.home)
      const awayScore = parseInt(r.away)

      // 1. Atualiza o placar do jogo
      const { error: updateError } = await supabase
        .from('games')
        .update({ home_score: homeScore, away_score: awayScore, is_finished: true })
        .eq('id', game.id)

      if (updateError) {
        setSaveStatus(prev => ({ ...prev, [game.id]: 'error' }))
        setSaveErrors(prev => ({
          ...prev,
          [game.id]: `Erro ao salvar resultado: ${updateError.message}`,
        }))
        return
      }

      // 2. Calcula pontos de todos os palpites deste jogo
      const { error: rpcError } = await supabase.rpc('calculate_points', {
        game_id_param: game.id,
      })

      if (rpcError) {
        // Resultado foi salvo, mas o cálculo falhou — informa separadamente
        setSaveStatus(prev => ({ ...prev, [game.id]: 'error' }))
        setSaveErrors(prev => ({
          ...prev,
          [game.id]: `Resultado salvo, mas erro ao calcular pontos: ${rpcError.message}`,
        }))
        // Ainda atualiza o estado local do jogo (o placar foi salvo)
        setGames(prev => prev.map(g =>
          g.id === game.id
            ? { ...g, home_score: homeScore, away_score: awayScore, is_finished: true }
            : g
        ))
        return
      }

      // 3. Tudo certo — atualiza estado local
      setGames(prev => prev.map(g =>
        g.id === game.id
          ? { ...g, home_score: homeScore, away_score: awayScore, is_finished: true }
          : g
      ))

      setSaveStatus(prev => ({ ...prev, [game.id]: 'success' }))
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [game.id]: 'idle' })), 3000)

    } catch (err) {
      console.error('Erro inesperado ao salvar resultado:', err)
      setSaveStatus(prev => ({ ...prev, [game.id]: 'error' }))
      setSaveErrors(prev => ({
        ...prev,
        [game.id]: 'Erro inesperado. Verifique o console e tente novamente.',
      }))
    }
  }

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingGame(true)
    setGameMsg('')
    try {
      const { error } = await supabase.from('games').insert({
        home_team: newGame.home_team.trim(),
        away_team: newGame.away_team.trim(),
        home_flag: newGame.home_flag.trim() || '🏳',
        away_flag: newGame.away_flag.trim() || '🏳',
        match_date: newGame.match_date,
        stage: newGame.stage,
      })
      if (error) { setGameMsg('Erro: ' + error.message); return }
      setGameMsg('✅ Jogo adicionado!')
      setNewGame({ home_team: '', away_team: '', home_flag: '', away_flag: '', match_date: '', stage: 'Fase de Grupos' })
      const { data } = await supabase.from('games').select('*').order('match_date', { ascending: true })
      setGames(data ?? [])
    } finally {
      setAddingGame(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Carregando...</div>

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '2.5rem' }}>
            Painel <span className="trophy-gradient">Admin</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Gerencie os jogos e resultados do bolão.</p>
        </div>
        <span className="badge badge-gold" style={{ marginLeft: 'auto' }}>⚙ {player?.display_name}</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        <TabButton active={tab === 'results'} onClick={() => setTab('results')}>✅ Inserir Resultados</TabButton>
        <TabButton active={tab === 'new-game'} onClick={() => setTab('new-game')}>➕ Novo Jogo</TabButton>
      </div>

      {tab === 'results' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Insira o resultado final de cada jogo. Os pontos serão calculados automaticamente.
          </p>
          {games.map(game => {
            const status = saveStatus[game.id] ?? 'idle'
            const errMsg = saveErrors[game.id] ?? ''

            return (
              <div key={game.id} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>

                  {/* Identificação do jogo */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{game.home_flag}</span>
                      <span style={{ fontWeight: 600 }}>{game.home_team}</span>
                      <span style={{ color: 'var(--text-muted)' }}>vs</span>
                      <span style={{ fontWeight: 600 }}>{game.away_team}</span>
                      <span style={{ fontSize: '1.5rem' }}>{game.away_flag}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'Barlow Condensed', letterSpacing: '0.05em' }}>
                      {format(new Date(game.match_date), "d MMM 'às' HH:mm", { locale: ptBR })} · {game.stage}
                    </div>
                  </div>

                  {/* Inputs de placar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      className="input-score"
                      style={{ width: '3.5rem', fontSize: '1.5rem' }}
                      type="number" min="0" max="99"
                      value={results[game.id]?.home ?? ''}
                      onChange={e => setResults(prev => ({
                        ...prev,
                        [game.id]: { ...prev[game.id], home: e.target.value.replace(/\D/g, '').slice(0, 2) },
                      }))}
                      placeholder="–"
                    />
                    <span className="font-display" style={{ color: 'var(--text-muted)' }}>×</span>
                    <input
                      className="input-score"
                      style={{ width: '3.5rem', fontSize: '1.5rem' }}
                      type="number" min="0" max="99"
                      value={results[game.id]?.away ?? ''}
                      onChange={e => setResults(prev => ({
                        ...prev,
                        [game.id]: { ...prev[game.id], away: e.target.value.replace(/\D/g, '').slice(0, 2) },
                      }))}
                      placeholder="–"
                    />
                  </div>

                  {/* Status + botão */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {status === 'success' && (
                      <span className="badge badge-green">✓ Pontos calculados!</span>
                    )}
                    {status !== 'success' && game.is_finished && (
                      <span className="badge badge-green">✓ Finalizado</span>
                    )}
                    {status !== 'success' && !game.is_finished && (
                      <span className="badge badge-muted">Pendente</span>
                    )}

                    <button
                      className="btn-gold"
                      style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                      onClick={() => handleSaveResult(game)}
                      disabled={
                        status === 'saving' ||
                        !results[game.id]?.home ||
                        !results[game.id]?.away
                      }
                    >
                      {status === 'saving'
                        ? '⏳ Salvando...'
                        : game.is_finished
                          ? '↻ Atualizar'
                          : '✓ Confirmar'
                      }
                    </button>
                  </div>
                </div>

                {/* Mensagem de erro por jogo */}
                {status === 'error' && errMsg && (
                  <div style={{
                    marginTop: '0.75rem',
                    background: 'rgba(255,71,87,0.1)',
                    border: '1px solid rgba(255,71,87,0.3)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.9rem',
                    color: 'var(--red)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                  }}>
                    <span style={{ flexShrink: 0 }}>⚠️</span>
                    <span>{errMsg}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'new-game' && (
        <div style={{ maxWidth: '560px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Os jogos da fase de grupos já foram inseridos pelo schema SQL. Use este formulário para adicionar fases eliminatórias ou jogos extras.
          </p>
          <div className="card" style={{ padding: '1.75rem' }}>
            <form onSubmit={handleAddGame} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormField label="Time da casa"        value={newGame.home_team}  onChange={v => setNewGame(p => ({ ...p, home_team: v }))}  placeholder="Brasil" />
                <FormField label="Time visitante"      value={newGame.away_team}  onChange={v => setNewGame(p => ({ ...p, away_team: v }))}  placeholder="Argentina" />
                <FormField label="Bandeira (emoji) casa" value={newGame.home_flag} onChange={v => setNewGame(p => ({ ...p, home_flag: v }))} placeholder="🇧🇷" />
                <FormField label="Bandeira (emoji) fora" value={newGame.away_flag} onChange={v => setNewGame(p => ({ ...p, away_flag: v }))} placeholder="🇦🇷" />
              </div>
              <FormField label="Data e hora" value={newGame.match_date} onChange={v => setNewGame(p => ({ ...p, match_date: v }))} type="datetime-local" />
              <div>
                <label className="font-ui" style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Fase</label>
                <select className="input" value={newGame.stage} onChange={e => setNewGame(p => ({ ...p, stage: e.target.value }))}>
                  {['Fase de Grupos', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Disputa 3º Lugar', 'Final'].map(s => (
                    <option key={s} value={s} style={{ background: 'var(--bg-card)' }}>{s}</option>
                  ))}
                </select>
              </div>

              {gameMsg && (
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: '8px',
                  background: gameMsg.startsWith('✅') ? 'rgba(0,214,79,0.1)' : 'rgba(255,71,87,0.1)',
                  border: `1px solid ${gameMsg.startsWith('✅') ? 'rgba(0,214,79,0.3)' : 'rgba(255,71,87,0.3)'}`,
                  color: gameMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)',
                  fontSize: '0.9rem',
                }}>
                  {gameMsg}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={addingGame} style={{ marginTop: '0.5rem' }}>
                {addingGame ? 'Adicionando...' : '➕ Adicionar Jogo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem',
      letterSpacing: '0.06em', textTransform: 'uppercase',
      color: active ? 'var(--gold)' : 'var(--text-muted)',
      padding: '0.5rem 1rem',
      borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
      marginBottom: '-1px', transition: 'color 0.2s',
    }}>
      {children}
    </button>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="font-ui" style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
        {label}
      </label>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required />
    </div>
  )
}

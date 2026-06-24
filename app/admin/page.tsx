'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Player, Game, GroupStanding, BestThird } from '@/lib/supabase'
import { clearLocalAuthState, getCurrentSessionSafe, getPlayerForSessionSafe } from '@/lib/auth'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type SaveStatus = 'idle' | 'saving' | 'success' | 'error'
type AdminTab = 'results' | 'new-game' | 'knockout'

const STAGES = ['Fase de Grupos', '16 avos', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Disputa 3º Lugar', 'Final']

export default function AdminPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [standings, setStandings] = useState<GroupStanding[]>([])
  const [bestThirds, setBestThirds] = useState<BestThird[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<AdminTab>('results')
  const [knockoutError, setKnockoutError] = useState('')
  const [knockoutMsg, setKnockoutMsg] = useState('')
  const [generating, setGenerating] = useState(false)
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [winnerSelections, setWinnerSelections] = useState<Record<string, string>>({})
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({})
  const [savingOverride, setSavingOverride] = useState<string | null>(null)
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

  const refreshGames = useCallback(async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('match_date', { ascending: true })

    if (error) throw error

    const gamesList = data ?? []
    setGames(gamesList)

    const initResults: Record<string, { home: string; away: string }> = {}
    for (const g of gamesList) {
      initResults[g.id] = {
        home: g.home_score != null ? String(g.home_score) : '',
        away: g.away_score != null ? String(g.away_score) : '',
      }
    }
    setResults(initResults)
  }, [])

  const refreshKnockoutData = useCallback(async () => {
    setKnockoutError('')

    const [standingsResult, thirdsResult] = await Promise.all([
      supabase.rpc('get_group_standings'),
      supabase.rpc('get_best_thirds'),
    ])

    if (standingsResult.error || thirdsResult.error) {
      setStandings([])
      setBestThirds([])
      setKnockoutError('A migração do mata-mata ainda não foi aplicada ou houve erro nas RPCs.')
      return
    }

    const standingsData = (standingsResult.data ?? []) as GroupStanding[]
    setStandings(standingsData)
    setBestThirds((thirdsResult.data ?? []) as BestThird[])

    const drafts: Record<string, string> = {}
    for (const row of standingsData) {
      drafts[row.team_id] = row.manual_tiebreak_order != null ? String(row.manual_tiebreak_order) : ''
    }
    setOverrideDrafts(drafts)
  }, [])

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
        await refreshGames()
        await refreshKnockoutData()
      } catch (err) {
        console.error('Erro inesperado ao carregar admin:', err)
        if (isMounted) router.push('/')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [refreshGames, refreshKnockoutData, router])

  const handleSaveResult = async (game: Game) => {
    const r = results[game.id]
    if (!r || r.home === '' || r.away === '') return

    setSaveStatus(prev => ({ ...prev, [game.id]: 'saving' }))
    setSaveErrors(prev => ({ ...prev, [game.id]: '' }))

    try {
      const homeScore = parseInt(r.home)
      const awayScore = parseInt(r.away)

      const { error: updateError } = await supabase
        .from('games')
        .update({ home_score: homeScore, away_score: awayScore, is_finished: true })
        .eq('id', game.id)

      if (updateError) {
        setSaveStatus(prev => ({ ...prev, [game.id]: 'error' }))
        setSaveErrors(prev => ({ ...prev, [game.id]: `Erro ao salvar resultado: ${updateError.message}` }))
        return
      }

      const { error: rpcError } = await supabase.rpc('calculate_points', { game_id_param: game.id })
      if (rpcError) {
        setSaveStatus(prev => ({ ...prev, [game.id]: 'error' }))
        setSaveErrors(prev => ({ ...prev, [game.id]: `Resultado salvo, mas erro ao calcular pontos: ${rpcError.message}` }))
        await refreshGames()
        return
      }

      await refreshGames()
      await refreshKnockoutData()
      setSaveStatus(prev => ({ ...prev, [game.id]: 'success' }))
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [game.id]: 'idle' })), 3000)
    } catch (err) {
      console.error('Erro inesperado ao salvar resultado:', err)
      setSaveStatus(prev => ({ ...prev, [game.id]: 'error' }))
      setSaveErrors(prev => ({ ...prev, [game.id]: 'Erro inesperado. Verifique o console e tente novamente.' }))
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
        is_published: true,
      })
      if (error) { setGameMsg('Erro: ' + error.message); return }
      setGameMsg('Jogo adicionado!')
      setNewGame({ home_team: '', away_team: '', home_flag: '', away_flag: '', match_date: '', stage: 'Fase de Grupos' })
      await refreshGames()
    } finally {
      setAddingGame(false)
    }
  }

  const handleGenerateRoundOf32 = async () => {
    setGenerating(true)
    setKnockoutMsg('')
    setKnockoutError('')
    try {
      const { data, error } = await supabase.rpc('generate_round_of_32')
      if (error) {
        setKnockoutError(error.message)
        return
      }
      setKnockoutMsg(String(data ?? '16 avos gerados.'))
      await refreshGames()
      await refreshKnockoutData()
    } finally {
      setGenerating(false)
    }
  }

  const handleAdvanceWinner = async (game: Game) => {
    setAdvancing(game.id)
    setKnockoutMsg('')
    setKnockoutError('')
    try {
      const selectedWinner = winnerSelections[game.id] || null
      const { data, error } = await supabase.rpc('advance_knockout_winner', {
        game_id_param: game.id,
        winner_team_id_param: selectedWinner,
      })
      if (error) {
        setKnockoutError(error.message)
        return
      }
      setKnockoutMsg(String(data ?? 'Vencedor avançado.'))
      await refreshGames()
      await refreshKnockoutData()
    } finally {
      setAdvancing(null)
    }
  }

  const handleSaveOverride = async (teamId: string) => {
    setSavingOverride(teamId)
    setKnockoutMsg('')
    setKnockoutError('')
    try {
      const value = overrideDrafts[teamId]
      const parsed = value === '' ? null : parseInt(value)
      const { error } = await supabase
        .from('team_standings_overrides')
        .upsert({ team_id: teamId, manual_tiebreak_order: parsed, updated_at: new Date().toISOString() })

      if (error) {
        setKnockoutError(error.message)
        return
      }

      setKnockoutMsg('Desempate salvo.')
      await refreshKnockoutData()
    } finally {
      setSavingOverride(null)
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
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Gerencie jogos, resultados e fases do bolão.</p>
        </div>
        <span className="badge badge-gold" style={{ marginLeft: 'auto' }}>Admin {player?.display_name}</span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: 0, flexWrap: 'wrap' }}>
        <TabButton active={tab === 'results'} onClick={() => setTab('results')}>Inserir Resultados</TabButton>
        <TabButton active={tab === 'knockout'} onClick={() => setTab('knockout')}>Classificação e Mata-mata</TabButton>
        <TabButton active={tab === 'new-game'} onClick={() => setTab('new-game')}>Novo Jogo</TabButton>
      </div>

      {tab === 'results' && (
        <ResultsTab
          games={games}
          results={results}
          saveStatus={saveStatus}
          saveErrors={saveErrors}
          onResultChange={(gameId, side, value) => setResults(prev => ({
            ...prev,
            [gameId]: { ...prev[gameId], [side]: value.replace(/\D/g, '').slice(0, 2) },
          }))}
          onSave={handleSaveResult}
        />
      )}

      {tab === 'knockout' && (
        <KnockoutTab
          games={games}
          standings={standings}
          bestThirds={bestThirds}
          error={knockoutError}
          message={knockoutMsg}
          generating={generating}
          advancing={advancing}
          winnerSelections={winnerSelections}
          overrideDrafts={overrideDrafts}
          savingOverride={savingOverride}
          onGenerate={handleGenerateRoundOf32}
          onAdvance={handleAdvanceWinner}
          onWinnerChange={(gameId, teamId) => setWinnerSelections(prev => ({ ...prev, [gameId]: teamId }))}
          onOverrideChange={(teamId, value) => setOverrideDrafts(prev => ({ ...prev, [teamId]: value.replace(/[^\d]/g, '').slice(0, 3) }))}
          onSaveOverride={handleSaveOverride}
        />
      )}

      {tab === 'new-game' && (
        <NewGameTab
          newGame={newGame}
          addingGame={addingGame}
          gameMsg={gameMsg}
          onChange={(field, value) => setNewGame(prev => ({ ...prev, [field]: value }))}
          onSubmit={handleAddGame}
        />
      )}
    </div>
  )
}

function ResultsTab({ games, results, saveStatus, saveErrors, onResultChange, onSave }: {
  games: Game[]
  results: Record<string, { home: string; away: string }>
  saveStatus: Record<string, SaveStatus>
  saveErrors: Record<string, string>
  onResultChange: (gameId: string, side: 'home' | 'away', value: string) => void
  onSave: (game: Game) => void
}) {
  return (
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
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {game.match_number && <span className="badge badge-muted">Jogo {game.match_number}</span>}
                  <span style={{ fontSize: '1.5rem' }}>{game.home_flag}</span>
                  <span style={{ fontWeight: 600 }}>{game.home_team}</span>
                  <span style={{ color: 'var(--text-muted)' }}>vs</span>
                  <span style={{ fontWeight: 600 }}>{game.away_team}</span>
                  <span style={{ fontSize: '1.5rem' }}>{game.away_flag}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'Barlow Condensed', letterSpacing: '0.05em' }}>
                  {format(new Date(game.match_date), "d MMM 'às' HH:mm", { locale: ptBR })} · {game.stage}
                  {game.is_published === false && ' · não publicado'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  className="input-score"
                  style={{ width: '3.5rem', fontSize: '1.5rem' }}
                  type="number"
                  min="0"
                  max="99"
                  value={results[game.id]?.home ?? ''}
                  onChange={e => onResultChange(game.id, 'home', e.target.value)}
                  placeholder="-"
                />
                <span className="font-display" style={{ color: 'var(--text-muted)' }}>x</span>
                <input
                  className="input-score"
                  style={{ width: '3.5rem', fontSize: '1.5rem' }}
                  type="number"
                  min="0"
                  max="99"
                  value={results[game.id]?.away ?? ''}
                  onChange={e => onResultChange(game.id, 'away', e.target.value)}
                  placeholder="-"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {status === 'success' && <span className="badge badge-green">Pontos calculados</span>}
                {status !== 'success' && game.is_finished && <span className="badge badge-green">Finalizado</span>}
                {status !== 'success' && !game.is_finished && <span className="badge badge-muted">Pendente</span>}
                <button
                  className="btn-gold"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                  onClick={() => onSave(game)}
                  disabled={status === 'saving' || results[game.id]?.home === '' || results[game.id]?.away === ''}
                >
                  {status === 'saving' ? 'Salvando...' : game.is_finished ? 'Atualizar' : 'Confirmar'}
                </button>
              </div>
            </div>

            {status === 'error' && errMsg && (
              <div style={{ marginTop: '0.75rem', background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: '8px', padding: '0.6rem 0.9rem', color: 'var(--red)', fontSize: '0.85rem' }}>
                {errMsg}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function KnockoutTab({ games, standings, bestThirds, error, message, generating, advancing, winnerSelections, overrideDrafts, savingOverride, onGenerate, onAdvance, onWinnerChange, onOverrideChange, onSaveOverride }: {
  games: Game[]
  standings: GroupStanding[]
  bestThirds: BestThird[]
  error: string
  message: string
  generating: boolean
  advancing: string | null
  winnerSelections: Record<string, string>
  overrideDrafts: Record<string, string>
  savingOverride: string | null
  onGenerate: () => void
  onAdvance: (game: Game) => void
  onWinnerChange: (gameId: string, teamId: string) => void
  onOverrideChange: (teamId: string, value: string) => void
  onSaveOverride: (teamId: string) => void
}) {
  const knockoutGames = games
    .filter(game => game.stage !== 'Fase de Grupos')
    .sort((a, b) => (a.match_number ?? 999) - (b.match_number ?? 999))
  const groups = Array.from(new Set(standings.map(row => row.group_code)))
  const unfinishedGroupGames = games.filter(game => game.stage === 'Fase de Grupos' && !game.is_finished).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 className="font-display" style={{ fontSize: '1.6rem' }}>Gerar 16 avos</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {unfinishedGroupGames === 0
              ? 'Todos os jogos de grupos estão finalizados. A geração cria/publica os confrontos reais.'
              : `${unfinishedGroupGames} jogo(s) da fase de grupos ainda pendente(s).`}
          </p>
        </div>
        <button className="btn-gold" onClick={onGenerate} disabled={generating || unfinishedGroupGames > 0}>
          {generating ? 'Gerando...' : 'Gerar 16 avos'}
        </button>
      </div>

      <section>
        <SectionLabel title="Classificação dos grupos" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {groups.map(group => (
            <div key={group} className="card" style={{ padding: '1rem' }}>
              <h3 className="font-display" style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>Grupo {group}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {standings.filter(row => row.group_code === group).map(row => (
                  <StandingRow
                    key={row.team_id}
                    row={row}
                    overrideValue={overrideDrafts[row.team_id] ?? ''}
                    saving={savingOverride === row.team_id}
                    onOverrideChange={value => onOverrideChange(row.team_id, value)}
                    onSaveOverride={() => onSaveOverride(row.team_id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel title="Melhores terceiros" />
        <div className="card" style={{ padding: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'left' }}>
                <th>#</th><th>Seleção</th><th>Grupo</th><th>Pts</th><th>SG</th><th>GP</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bestThirds.map(row => (
                <tr key={row.team_id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.6rem 0' }}>{row.third_rank}</td>
                  <td>{row.flag} {row.team_name}</td>
                  <td>{row.group_code}</td>
                  <td>{row.points}</td>
                  <td>{row.goal_difference}</td>
                  <td>{row.goals_for}</td>
                  <td><span className={row.qualified ? 'badge badge-green' : 'badge badge-muted'}>{row.qualified ? 'Classifica' : 'Fora'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionLabel title="Mata-mata" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {knockoutGames.length === 0 && (
            <div className="card" style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>Nenhum jogo de mata-mata gerado ainda.</div>
          )}
          {knockoutGames.map(game => (
            <KnockoutGameCard
              key={game.id}
              game={game}
              advancing={advancing === game.id}
              selectedWinner={winnerSelections[game.id] ?? ''}
              onWinnerChange={value => onWinnerChange(game.id, value)}
              onAdvance={() => onAdvance(game)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function StandingRow({ row, overrideValue, saving, onOverrideChange, onSaveOverride }: {
  row: GroupStanding
  overrideValue: string
  saving: boolean
  onOverrideChange: (value: string) => void
  onSaveOverride: () => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.6rem', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
      <span className="font-display" style={{ color: row.group_position <= 2 ? 'var(--green)' : row.group_position === 3 ? 'var(--gold)' : 'var(--text-muted)' }}>{row.group_position}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.flag} {row.team_name}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {row.points} pts · SG {row.goal_difference} · GP {row.goals_for}
        </div>
      </div>
      <input
        className="input"
        style={{ width: '4rem', padding: '0.35rem 0.45rem', fontSize: '0.8rem' }}
        value={overrideValue}
        onChange={e => onOverrideChange(e.target.value)}
        placeholder="ord"
        title="Ordem manual de desempate"
      />
      <button className="btn-outline" style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }} onClick={onSaveOverride} disabled={saving}>
        {saving ? '...' : 'Salvar'}
      </button>
    </div>
  )
}

function KnockoutGameCard({ game, advancing, selectedWinner, onWinnerChange, onAdvance }: {
  game: Game
  advancing: boolean
  selectedWinner: string
  onWinnerChange: (value: string) => void
  onAdvance: () => void
}) {
  const isTie = game.is_finished && game.home_score != null && game.away_score != null && game.home_score === game.away_score
  const canAdvance = game.is_finished && !!game.home_team_id && !!game.away_team_id && !game.winner_team_id

  return (
    <div className="card" style={{ padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-muted">Jogo {game.match_number}</span>
            <span className="badge badge-muted">{game.stage}</span>
            {game.is_published === false && <span className="badge badge-red">Não publicado</span>}
            {game.winner_team_id && <span className="badge badge-green">Vencedor avançado</span>}
          </div>
          <div style={{ marginTop: '0.55rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <strong>{game.home_flag} {game.home_team}</strong>
            <span style={{ color: 'var(--text-muted)' }}>
              {game.is_finished ? `${game.home_score} x ${game.away_score}` : 'vs'}
            </span>
            <strong>{game.away_team} {game.away_flag}</strong>
          </div>
        </div>

        {isTie && canAdvance && (
          <select className="input" style={{ width: '220px' }} value={selectedWinner} onChange={e => onWinnerChange(e.target.value)}>
            <option value="">Escolha o vencedor</option>
            {game.home_team_id && <option value={game.home_team_id}>{game.home_team}</option>}
            {game.away_team_id && <option value={game.away_team_id}>{game.away_team}</option>}
          </select>
        )}

        <button className="btn-gold" onClick={onAdvance} disabled={!canAdvance || advancing || (isTie && !selectedWinner)}>
          {advancing ? 'Avançando...' : game.winner_team_id ? 'Avançado' : 'Avançar vencedor'}
        </button>
      </div>
    </div>
  )
}

function NewGameTab({ newGame, addingGame, gameMsg, onChange, onSubmit }: {
  newGame: { home_team: string; away_team: string; home_flag: string; away_flag: string; match_date: string; stage: string }
  addingGame: boolean
  gameMsg: string
  onChange: (field: keyof typeof newGame, value: string) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div style={{ maxWidth: '560px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Use este formulário para adicionar jogos extras. Para o mata-mata oficial, prefira a aba de classificação.
      </p>
      <div className="card" style={{ padding: '1.75rem' }}>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Time da casa" value={newGame.home_team} onChange={v => onChange('home_team', v)} placeholder="Brasil" />
            <FormField label="Time visitante" value={newGame.away_team} onChange={v => onChange('away_team', v)} placeholder="Argentina" />
            <FormField label="Bandeira casa" value={newGame.home_flag} onChange={v => onChange('home_flag', v)} placeholder="🇧🇷" />
            <FormField label="Bandeira fora" value={newGame.away_flag} onChange={v => onChange('away_flag', v)} placeholder="🇦🇷" />
          </div>
          <FormField label="Data e hora" value={newGame.match_date} onChange={v => onChange('match_date', v)} type="datetime-local" />
          <div>
            <label className="font-ui" style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Fase</label>
            <select className="input" value={newGame.stage} onChange={e => onChange('stage', e.target.value)}>
              {STAGES.map(stage => <option key={stage} value={stage} style={{ background: 'var(--bg-card)' }}>{stage}</option>)}
            </select>
          </div>

          {gameMsg && <Alert tone={gameMsg.startsWith('Erro') ? 'error' : 'success'}>{gameMsg}</Alert>}

          <button type="submit" className="btn-primary" disabled={addingGame} style={{ marginTop: '0.5rem' }}>
            {addingGame ? 'Adicionando...' : 'Adicionar Jogo'}
          </button>
        </form>
      </div>
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

function SectionLabel({ title }: { title: string }) {
  return (
    <h2 className="font-ui" style={{ fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 700 }}>
      {title}
    </h2>
  )
}

function Alert({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      background: tone === 'success' ? 'rgba(0,214,79,0.1)' : 'rgba(255,71,87,0.1)',
      border: `1px solid ${tone === 'success' ? 'rgba(0,214,79,0.3)' : 'rgba(255,71,87,0.3)'}`,
      color: tone === 'success' ? 'var(--green)' : 'var(--red)',
      fontSize: '0.9rem',
    }}>
      {children}
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
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

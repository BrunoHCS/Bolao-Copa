'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Player, Game, Bet } from '@/lib/supabase'
import { format, isPast, addHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function PalpitesPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [bets, setBets] = useState<Record<string, Bet>>({})
  const [drafts, setDrafts] = useState<Record<string, { home: string; away: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [{ data: playerData }, { data: gamesData }] = await Promise.all([
        supabase.from('players').select('*').eq('id', session.user.id).single(),
        supabase.from('games').select('*').order('match_date', { ascending: true }),
      ])

      if (!playerData) { router.push('/login'); return }
      setPlayer(playerData)

      const { data: betsData } = await supabase
        .from('bets')
        .select('*')
        .eq('player_id', session.user.id)

      const betsMap: Record<string, Bet> = {}
      const draftsInit: Record<string, { home: string; away: string }> = {}
      for (const b of betsData ?? []) {
        betsMap[b.game_id] = b
        draftsInit[b.game_id] = { home: String(b.home_score), away: String(b.away_score) }
      }

      setGames(gamesData ?? [])
      setBets(betsMap)
      setDrafts(draftsInit)
      setLoading(false)
    }
    load()
  }, [router])

  const isLocked = (game: Game) => isPast(new Date(game.match_date)) || game.is_finished

  const handleDraftChange = (gameId: string, side: 'home' | 'away', value: string) => {
    const num = value.replace(/\D/g, '').slice(0, 2)
    setDrafts(prev => ({ ...prev, [gameId]: { ...prev[gameId], [side]: num } }))
  }

  const handleSave = async (game: Game) => {
    if (!player) return
    const draft = drafts[game.id]
    if (!draft || draft.home === '' || draft.away === '') return

    setSaving(game.id)
    try {
      const homeScore = parseInt(draft.home)
      const awayScore = parseInt(draft.away)

      const { error } = await supabase.from('bets').upsert({
        player_id: player.id,
        game_id: game.id,
        home_score: homeScore,
        away_score: awayScore,
        points: 0,
      }, { onConflict: 'player_id,game_id' })

      if (!error) {
        setBets(prev => ({ ...prev, [game.id]: { ...prev[game.id], player_id: player.id, game_id: game.id, home_score: homeScore, away_score: awayScore, points: 0, id: prev[game.id]?.id ?? '' } }))
        setSaved(game.id)
        setTimeout(() => setSaved(null), 2000)
      }
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <Loading />

  const totalBets = Object.keys(bets).length
  const availableGames = games.filter(g => !g.is_finished)
  const finishedGames = games.filter(g => g.is_finished)

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="font-display" style={{ fontSize: '2.5rem' }}>
          Meus <span className="green-gradient">Palpites</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Olá, <strong style={{ color: 'var(--text-primary)' }}>{player?.display_name}</strong>! Você tem <strong style={{ color: 'var(--green)' }}>{totalBets}</strong> palpites registrados.
        </p>
      </div>

      {/* Regras rápidas */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <RuleChip pts="3pts" label="Placar exato" color="var(--gold)" />
        <RuleChip pts="1pt" label="Vencedor / Empate" color="var(--green)" />
        <RuleChip pts="0pts" label="Errou" color="var(--text-muted)" />
        <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          🔒 Palpites fecham quando o jogo começa
        </div>
      </div>

      {/* Jogos disponíveis */}
      {availableGames.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <SectionTitle>⚽ Jogos Disponíveis ({availableGames.length})</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {availableGames.map(game => (
              <BetCard
                key={game.id}
                game={game}
                bet={bets[game.id]}
                draft={drafts[game.id] ?? { home: '', away: '' }}
                locked={isLocked(game)}
                saving={saving === game.id}
                savedOk={saved === game.id}
                onChange={(side, val) => handleDraftChange(game.id, side, val)}
                onSave={() => handleSave(game)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Jogos finalizados com meus palpites */}
      {finishedGames.length > 0 && (
        <div>
          <SectionTitle>✅ Jogos Finalizados</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {finishedGames.map(game => (
              <FinishedCard key={game.id} game={game} bet={bets[game.id]} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BetCard({ game, bet, draft, locked, saving, savedOk, onChange, onSave }: {
  game: Game; bet?: Bet; draft: { home: string; away: string };
  locked: boolean; saving: boolean; savedOk: boolean;
  onChange: (side: 'home' | 'away', val: string) => void;
  onSave: () => void;
}) {
  const hasBet = !!bet
  const hasChanged = hasBet ? (String(bet.home_score) !== draft.home || String(bet.away_score) !== draft.away) : (draft.home !== '' || draft.away !== '')
  const canSave = !locked && draft.home !== '' && draft.away !== '' && hasChanged

  return (
    <div className={`game-card ${hasBet ? 'has-bet' : ''} ${locked ? 'finished' : ''}`} style={{ cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="font-ui" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {format(new Date(game.match_date), "d MMM 'às' HH:mm", { locale: ptBR })}
          </span>
          <span className="badge badge-muted">{game.stage}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {hasBet && !locked && <span className="badge badge-green">✓ Salvo</span>}
          {locked && <span className="badge badge-muted">🔒 Fechado</span>}
          {savedOk && <span className="badge badge-green" style={{ animation: 'fade-up 0.3s ease' }}>✓ Salvo!</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <TeamDisplay flag={game.home_flag} name={game.home_team} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
          <input
            className="input-score"
            type="number"
            min="0" max="99"
            value={draft.home ?? ''}
            onChange={e => onChange('home', e.target.value)}
            disabled={locked}
            placeholder="–"
          />
          <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>×</span>
          <input
            className="input-score"
            type="number"
            min="0" max="99"
            value={draft.away ?? ''}
            onChange={e => onChange('away', e.target.value)}
            disabled={locked}
            placeholder="–"
          />
        </div>
        <TeamDisplay flag={game.away_flag} name={game.away_team} align="right" />
      </div>

      {!locked && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            onClick={onSave}
            disabled={!canSave || saving}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            {saving ? '💾 Salvando...' : hasBet ? '↻ Atualizar' : '💾 Salvar palpite'}
          </button>
        </div>
      )}

      {locked && hasBet && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Seu palpite:</span>
          <span className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
            {bet.home_score} × {bet.away_score}
          </span>
        </div>
      )}
    </div>
  )
}

function FinishedCard({ game, bet }: { game: Game; bet?: Bet }) {
  const getPointsColor = (pts?: number) => pts === 3 ? 'var(--gold)' : pts === 1 ? 'var(--green)' : 'var(--red)'
  const getPointsLabel = (pts?: number) => pts === 3 ? '🎯 Placar exato!' : pts === 1 ? '✓ Resultado' : pts === 0 ? '✗ Errou' : '—'

  return (
    <div className="game-card finished" style={{ cursor: 'default', opacity: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span className="font-ui" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {format(new Date(game.match_date), "d MMM", { locale: ptBR })} — {game.stage}
        </span>
        {bet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{getPointsLabel(bet.points)}</span>
            <span className="font-display" style={{ fontSize: '1.4rem', color: getPointsColor(bet.points) }}>
              {bet.points ?? 0} pts
            </span>
          </div>
        )}
        {!bet && <span className="badge badge-red">Sem palpite</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <TeamDisplay flag={game.home_flag} name={game.home_team} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="font-display" style={{ fontSize: '2rem', color: 'var(--green)' }}>
            {game.home_score} × {game.away_score}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Barlow Condensed' }}>Resultado final</div>
        </div>
        <TeamDisplay flag={game.away_flag} name={game.away_team} align="right" />
      </div>

      {bet && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Seu palpite:</span>
          <span className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            {bet.home_score} × {bet.away_score}
          </span>
        </div>
      )}
    </div>
  )
}

function TeamDisplay({ flag, name, align = 'left' }: { flag: string; name: string; align?: 'left' | 'right' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start', minWidth: '80px' }}>
      <span style={{ fontSize: '1.8rem' }}>{flag}</span>
      <span style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.15rem', textAlign: align }}>{name}</span>
    </div>
  )
}

function RuleChip({ pts, label, color }: { pts: string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <span className="font-display" style={{ fontSize: '1rem', color }}>{pts}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>= {label}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-ui" style={{ fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 700 }}>
      {children}
    </h2>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Carregando palpites...</span>
    </div>
  )
}

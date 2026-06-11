'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, Player, Group, Game, Bet } from '@/lib/supabase'
import { clearLocalAuthState, getCurrentSessionSafe, getPlayerForSessionSafe } from '@/lib/auth'
import { format, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type MemberWithPoints = Player & { joined_at: string }
type Tab = 'ranking' | 'palpites'

// { [game_id]: { [player_id]: Bet } }
type BetsMatrix = Record<string, Record<string, Bet>>

export default function GroupDetailPage() {
  const params = useParams()
  const groupId = params.id as string
  const router = useRouter()

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<MemberWithPoints[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [betsMatrix, setBetsMatrix] = useState<BetsMatrix>({})
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [showConfirmLeave, setShowConfirmLeave] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')
  const [tab, setTab] = useState<Tab>('ranking')

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
        if (playerResult.error || !playerResult.data) {
          setLoading(false)
          router.push('/login')
          return
        }
        setCurrentPlayer(playerResult.data)

        const { data: groupData, error: groupError } = await supabase
          .from('groups').select('*').eq('id', groupId).single()
        if (!isMounted) return
        if (groupError || !groupData) { router.push('/grupos'); return }
        setGroup(groupData)

        // Membros
        const { data: memberships, error: membErr } = await supabase
          .from('group_members')
          .select('player_id, joined_at')
          .eq('group_id', groupId)
        if (!isMounted) return
        if (membErr) { console.error('Erro ao carregar membros:', membErr); return }
        if (!memberships?.length) { setLoading(false); return }

        const playerIds = memberships.map(m => m.player_id)

        const { data: playersData, error: playersErr } = await supabase
          .from('players')
          .select('*')
          .in('id', playerIds)
          .order('total_points', { ascending: false })
        if (!isMounted) return
        if (playersErr) { console.error('Erro ao carregar jogadores:', playersErr); return }

        const joinedAtMap: Record<string, string> = {}
        for (const m of memberships) joinedAtMap[m.player_id] = m.joined_at
        setMembers((playersData ?? []).map(p => ({ ...p, joined_at: joinedAtMap[p.id] ?? '' })))

        // Jogos
        const { data: gamesData, error: gamesErr } = await supabase
          .from('games').select('*').order('match_date', { ascending: true })
        if (!isMounted) return
        if (gamesErr) { console.error('Erro ao carregar jogos:', gamesErr); return }
        setGames(gamesData ?? [])

        // Palpites de todos os membros — apenas jogos com horário passado
        const lockedGameIds = (gamesData ?? [])
          .filter(g => isPast(new Date(g.match_date)) || g.is_finished)
          .map(g => g.id)

        if (lockedGameIds.length > 0) {
          const { data: betsData, error: betsErr } = await supabase
            .from('bets')
            .select('*')
            .in('player_id', playerIds)
            .in('game_id', lockedGameIds)
          if (!isMounted) return
          if (betsErr) { console.error('Erro ao carregar palpites:', betsErr); return }

          const matrix: BetsMatrix = {}
          for (const bet of betsData ?? []) {
            if (!matrix[bet.game_id]) matrix[bet.game_id] = {}
            matrix[bet.game_id][bet.player_id] = bet
          }
          setBetsMatrix(matrix)
        }
      } catch (err) {
        console.error('Erro inesperado:', err)
        if (isMounted) router.push('/grupos')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [groupId, router])

  const handleLeave = async () => {
    if (!currentPlayer) return
    setLeaving(true)
    try {
      await supabase.from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('player_id', currentPlayer.id)
      router.push('/grupos')
    } finally {
      setLeaving(false)
    }
  }

  const handleCopyName = () => {
    if (!group) return
    navigator.clipboard.writeText(group.name)
    setCopyMsg('Copiado!')
    setTimeout(() => setCopyMsg(''), 2000)
  }

  if (loading) return <Loading />
  if (!group) return null

  const isOwner = currentPlayer?.id === group.owner_id
  const lockedGames = games.filter(g => isPast(new Date(g.match_date)) || g.is_finished)
  const totalLockedWithBets = lockedGames.filter(g => Object.keys(betsMatrix[g.id] ?? {}).length > 0).length

  return (
    <div className="animate-fade-up">
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/grupos" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'Barlow Condensed', letterSpacing: '0.05em' }}>
          ← Meus grupos
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <h1 className="font-display" style={{ fontSize: '2.5rem', lineHeight: 1 }}>{group.name}</h1>
            {isOwner && <span className="badge badge-gold">👑 Seu grupo</span>}
          </div>
          {group.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{group.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!isOwner && (
            <button
              className="btn-outline"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', borderColor: 'rgba(255,71,87,0.4)', color: 'var(--red)' }}
              onClick={() => setShowConfirmLeave(true)}
            >
              🚪 Sair do grupo
            </button>
          )}
        </div>
      </div>

      {/* Info compartilhar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="font-ui" style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
            📢 Convide seus amigos
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Compartilhe o nome <strong style={{ color: 'var(--text-primary)' }}>&quot;{group.name}&quot;</strong> e a senha do grupo. Eles entram em <strong style={{ color: 'var(--green)' }}>Grupos → Entrar em grupo</strong>.
          </p>
        </div>
        <button onClick={handleCopyName} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', whiteSpace: 'nowrap' }}>
          {copyMsg || '📋 Copiar nome'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        <TabButton active={tab === 'ranking'} onClick={() => setTab('ranking')}>
          🏆 Ranking
          <CountBadge count={members.length} />
        </TabButton>
        <TabButton active={tab === 'palpites'} onClick={() => setTab('palpites')}>
          🎯 Palpites
          {totalLockedWithBets > 0 && <CountBadge count={totalLockedWithBets} />}
        </TabButton>
      </div>

      {/* Tab: Ranking */}
      {tab === 'ranking' && (
        <RankingTab members={members} currentPlayer={currentPlayer} group={group} />
      )}

      {/* Tab: Palpites */}
      {tab === 'palpites' && (
        <PalpitesTab
          members={members}
          games={lockedGames}
          betsMatrix={betsMatrix}
          currentPlayerId={currentPlayer?.id ?? ''}
        />
      )}

      {/* Modal confirmar saída */}
      {showConfirmLeave && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowConfirmLeave(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '380px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚪</div>
            <h3 className="font-display" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Sair do grupo?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Você vai sair de <strong style={{ color: 'var(--text-primary)' }}>&quot;{group.name}&quot;</strong>. Para voltar vai precisar da senha novamente.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-outline" onClick={() => setShowConfirmLeave(false)} style={{ flex: 1 }}>Cancelar</button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                style={{ flex: 1, background: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.4)', color: 'var(--red)', borderRadius: '8px', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', padding: '0.75rem' }}
              >
                {leaving ? 'Saindo...' : 'Sair'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aba Ranking ─────────────────────────────────────────────────────────────

function RankingTab({ members, currentPlayer, group }: {
  members: MemberWithPoints[]
  currentPlayer: Player | null
  group: Group
}) {
  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <h2 className="font-display" style={{ fontSize: '1.6rem' }}>Ranking do Grupo</h2>
        <span className="badge badge-muted" style={{ marginLeft: '0.25rem' }}>
          {members.length} participante{members.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="card">
        {members.map((member, i) => (
          <div
            key={member.id}
            className="rank-row"
            style={{
              background: member.id === currentPlayer?.id
                ? 'rgba(0,214,79,0.04)'
                : i === 0 ? 'rgba(245,197,24,0.04)' : undefined,
              borderLeft: member.id === currentPlayer?.id
                ? '3px solid rgba(0,214,79,0.5)'
                : i === 0 ? '3px solid var(--gold)'
                  : i === 1 ? '3px solid #c0c0c0'
                    : i === 2 ? '3px solid #cd7f32'
                      : '3px solid transparent',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              {i < 3
                ? <span style={{ fontSize: '1.4rem' }}>{MEDALS[i]}</span>
                : <span className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>{i + 1}</span>
              }
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{member.display_name}</span>
                {member.id === currentPlayer?.id && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--green)', fontFamily: 'Barlow Condensed', letterSpacing: '0.06em', textTransform: 'uppercase' }}>você</span>
                )}
                {member.id === group.owner_id && (
                  <span style={{ fontSize: '0.75rem' }}>👑</span>
                )}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'Barlow Condensed', letterSpacing: '0.05em' }}>
                @{member.username}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="font-display" style={{ fontSize: '1.6rem', color: i === 0 ? 'var(--gold)' : 'var(--green)' }}>
                {member.total_points}
              </div>
              <div className="font-ui" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>pts</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Aba Palpites ─────────────────────────────────────────────────────────────

function PalpitesTab({ members, games, betsMatrix, currentPlayerId }: {
  members: MemberWithPoints[]
  games: Game[]
  betsMatrix: BetsMatrix
  currentPlayerId: string
}) {
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null)

  if (games.length === 0) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
        <h3 className="font-display" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Nenhum jogo encerrado ainda</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Os palpites ficam visíveis assim que o horário do jogo passa. Volte depois do primeiro apito!
        </p>
      </div>
    )
  }

  const finishedGames = games.filter(g => g.is_finished)
  const lockedNotFinished = games.filter(g => !g.is_finished)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Aviso de privacidade */}
      <div style={{ background: 'rgba(0,214,79,0.06)', border: '1px solid rgba(0,214,79,0.2)', borderRadius: '10px', padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: '1rem' }}>🔒</span>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
          Palpites ficam visíveis <strong style={{ color: 'var(--text-primary)' }}>somente após o horário de início</strong> de cada jogo — sem vantagem para ninguém.
        </p>
      </div>

      {/* Jogos finalizados */}
      {finishedGames.length > 0 && (
        <section>
          <SectionLabel icon="✅" label="Jogos Finalizados" count={finishedGames.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {finishedGames.map(game => (
              <BetsGameCard
                key={game.id}
                game={game}
                members={members}
                gameBets={betsMatrix[game.id] ?? {}}
                currentPlayerId={currentPlayerId}
                expanded={expandedGameId === game.id}
                onToggle={() => setExpandedGameId(prev => prev === game.id ? null : game.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Jogos travados, aguardando resultado */}
      {lockedNotFinished.length > 0 && (
        <section>
          <SectionLabel icon="⏱️" label="Aguardando Resultado" count={lockedNotFinished.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {lockedNotFinished.map(game => (
              <BetsGameCard
                key={game.id}
                game={game}
                members={members}
                gameBets={betsMatrix[game.id] ?? {}}
                currentPlayerId={currentPlayerId}
                expanded={expandedGameId === game.id}
                onToggle={() => setExpandedGameId(prev => prev === game.id ? null : game.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionLabel({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <span>{icon}</span>
      <span className="font-ui" style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>{count}</span>
    </div>
  )
}

// ─── Card de jogo com palpites expandíveis ───────────────────────────────────

function BetsGameCard({ game, members, gameBets, currentPlayerId, expanded, onToggle }: {
  game: Game
  members: MemberWithPoints[]
  gameBets: Record<string, Bet>
  currentPlayerId: string
  expanded: boolean
  onToggle: () => void
}) {
  const betCount = Object.keys(gameBets).length
  const hasResult = game.is_finished && game.home_score != null && game.away_score != null

  return (
    <div
      className="card"
      style={{
        overflow: 'hidden',
        borderColor: expanded ? 'var(--border-bright)' : undefined,
        transition: 'border-color 0.2s',
      }}
    >
      {/* Cabeçalho clicável */}
      <div
        onClick={onToggle}
        style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1, minWidth: '200px' }}>
          {/* Times + placar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.3rem' }}>{game.home_flag}</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{game.home_team}</span>

            {hasResult ? (
              <span className="font-display" style={{ fontSize: '1.35rem', color: 'var(--green)', padding: '0 0.3rem' }}>
                {game.home_score} – {game.away_score}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', padding: '0 0.3rem', fontSize: '0.9rem' }}>vs</span>
            )}

            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{game.away_team}</span>
            <span style={{ fontSize: '1.3rem' }}>{game.away_flag}</span>
          </div>

          {/* Data e fase */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="font-ui" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {format(new Date(game.match_date), "d MMM 'às' HH:mm", { locale: ptBR })}
            </span>
            <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>{game.stage}</span>
          </div>
        </div>

        {/* Badges + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <span className="badge badge-muted" style={{ fontSize: '0.72rem' }}>
            {betCount}/{members.length} palpite{betCount !== 1 ? 's' : ''}
          </span>
          {hasResult && (
            <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>✓ Finalizado</span>
          )}
          <span style={{
            color: 'var(--text-muted)', fontSize: '0.85rem',
            display: 'inline-block',
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▾
          </span>
        </div>
      </div>

      {/* Conteúdo expandido */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <BetsMembersTable
            members={members}
            gameBets={gameBets}
            game={game}
            currentPlayerId={currentPlayerId}
          />
        </div>
      )}
    </div>
  )
}

// ─── Tabela de membros e palpites ─────────────────────────────────────────────

function BetsMembersTable({ members, gameBets, game, currentPlayerId }: {
  members: MemberWithPoints[]
  gameBets: Record<string, Bet>
  game: Game
  currentPlayerId: string
}) {
  const hasResult = game.is_finished && game.home_score != null && game.away_score != null

  const getPointsBadge = (bet: Bet) => {
    if (!hasResult) return null
    if (bet.points === 3) return <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>🎯 3pts</span>
    if (bet.points === 1) return <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>✓ 1pt</span>
    return <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>✗ 0pts</span>
  }

  const getRowStyle = (bet: Bet | undefined, isMe: boolean): React.CSSProperties => ({
    padding: '0.75rem 1.25rem',
    display: 'grid',
    gridTemplateColumns: hasResult ? '1fr auto auto' : '1fr auto',
    gap: '1rem',
    alignItems: 'center',
    borderTop: '1px solid var(--border)',
    borderLeft: isMe
      ? '3px solid rgba(0,214,79,0.5)'
      : hasResult && bet?.points === 3 ? '3px solid var(--gold)'
        : hasResult && bet?.points === 1 ? '3px solid rgba(0,214,79,0.35)'
          : '3px solid transparent',
    background: isMe
      ? 'rgba(0,214,79,0.04)'
      : hasResult && bet?.points === 3 ? 'rgba(245,197,24,0.05)'
        : hasResult && bet?.points === 1 ? 'rgba(0,214,79,0.03)'
          : undefined,
    transition: 'background 0.15s',
  })

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{
        padding: '0.5rem 1.25rem',
        display: 'grid',
        gridTemplateColumns: hasResult ? '1fr auto auto' : '1fr auto',
        gap: '1rem',
        alignItems: 'center',
      }}>
        <span className="font-ui" style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Participante
        </span>
        <span className="font-ui" style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center', minWidth: '80px' }}>
          Palpite
        </span>
        {hasResult && (
          <span className="font-ui" style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'right', minWidth: '60px' }}>
            Pontos
          </span>
        )}
      </div>

      {/* Linhas — membros ordenados por pontos neste jogo (quem acertou primeiro) */}
      {[...members]
        .sort((a, b) => {
          if (!hasResult) return 0
          const pa = gameBets[a.id]?.points ?? -1
          const pb = gameBets[b.id]?.points ?? -1
          return pb - pa
        })
        .map(member => {
          const bet = gameBets[member.id]
          const isMe = member.id === currentPlayerId

          return (
            <div key={member.id} style={getRowStyle(bet, isMe)}>
              {/* Nome */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                <span style={{ fontWeight: isMe ? 700 : 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.display_name}
                </span>
                {isMe && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--green)', fontFamily: 'Barlow Condensed', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>você</span>
                )}
              </div>

              {/* Palpite */}
              <div style={{ minWidth: '80px', textAlign: 'center' }}>
                {bet ? (
                  <span className="font-display" style={{ fontSize: '1.3rem', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                    {bet.home_score} × {bet.away_score}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>sem palpite</span>
                )}
              </div>

              {/* Badge de pontos */}
              {hasResult && (
                <div style={{ minWidth: '60px', textAlign: 'right' }}>
                  {bet ? getPointsBadge(bet) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CountBadge({ count }: { count: number }) {
  return (
    <span className="badge badge-muted" style={{ marginLeft: '0.4rem', fontSize: '0.65rem', padding: '0.1rem 0.45rem' }}>
      {count}
    </span>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        color: active ? 'var(--green)' : 'var(--text-muted)',
        padding: '0.5rem 1rem',
        borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
        marginBottom: '-1px', transition: 'color 0.2s',
        display: 'flex', alignItems: 'center',
      }}
    >
      {children}
    </button>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Carregando grupo...</span>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ExpandableSection } from '@/components/ExpandableSection'
import { BestThird, Game, GroupStanding, supabase, WorldCupTeam } from '@/lib/supabase'

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export default function CopaPage() {
  const [teams, setTeams] = useState<WorldCupTeam[]>([])
  const [standings, setStandings] = useState<GroupStanding[]>([])
  const [bestThirds, setBestThirds] = useState<BestThird[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [rpcAvailable, setRpcAvailable] = useState(true)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const [teamsResult, gamesResult, standingsResult, thirdsResult] = await Promise.all([
          supabase.from('world_cup_teams').select('*').order('group_code').order('group_seed'),
          supabase.from('games').select('*').order('match_date', { ascending: true }),
          supabase.rpc('get_group_standings'),
          supabase.rpc('get_best_thirds'),
        ])

        if (!isMounted) return

        if (!teamsResult.error) setTeams((teamsResult.data ?? []) as WorldCupTeam[])
        if (!gamesResult.error) setGames(((gamesResult.data ?? []) as Game[]).filter(game => game.is_published !== false))

        if (standingsResult.error || thirdsResult.error) {
          setRpcAvailable(false)
        } else {
          setStandings((standingsResult.data ?? []) as GroupStanding[])
          setBestThirds((thirdsResult.data ?? []) as BestThird[])
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar Copa:', err)
        if (isMounted) setRpcAvailable(false)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [])

  const knockoutByStage = useMemo(() => groupGamesByStage(games.filter(game => game.stage !== 'Fase de Grupos')), [games])

  if (loading) return <Loading />

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 className="font-display" style={{ fontSize: '2.5rem', lineHeight: 1 }}>
          Copa <span className="trophy-gradient">2026</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', maxWidth: '680px' }}>
          Acompanhe os grupos, a briga pelos melhores terceiros e os confrontos publicados do mata-mata.
        </p>
      </header>

      {!rpcAvailable && (
        <div className="card" style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
          A classificação automática ainda não está disponível neste banco. Mostrando a lista de seleções por grupo.
        </div>
      )}

      <section>
        <SectionTitle title="Fase de Grupos" />
        <div className="card" style={{ padding: '0 1.25rem' }}>
          {GROUPS.map((group, index) => {
            const groupStandings = standings.filter(row => row.group_code === group)
            const groupTeams = teams.filter(team => team.group_code === group)
            const count = groupStandings.length || groupTeams.length

            return (
              <ExpandableSection
                key={group}
                title={`Grupo ${group}`}
                count={count}
                subtitle={groupStandings.length ? groupSummary(groupStandings) : undefined}
                mobileDefaultOpen={index === 0}
              >
                {groupStandings.length ? (
                  <StandingsTable rows={groupStandings} />
                ) : (
                  <TeamsList teams={groupTeams} />
                )}
              </ExpandableSection>
            )
          })}
        </div>
      </section>

      {bestThirds.length > 0 && (
        <section>
          <SectionTitle title="Melhores terceiros" />
          <div className="card" style={{ padding: '0 1.25rem' }}>
            <ExpandableSection title="Ranking dos terceiros" count={bestThirds.length} mobileDefaultOpen>
              <ThirdsTable rows={bestThirds} />
            </ExpandableSection>
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Mata-mata publicado" />
        {knockoutByStage.length === 0 ? (
          <div className="card" style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>
            Os jogos do mata-mata aparecem aqui quando forem gerados e publicados.
          </div>
        ) : (
          <div className="card" style={{ padding: '0 1.25rem' }}>
            {knockoutByStage.map((group, index) => (
              <ExpandableSection
                key={group.stage}
                title={group.stage}
                count={group.games.length}
                mobileDefaultOpen={index === 0}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {group.games.map(game => <CupGameCard key={game.id} game={game} />)}
                </div>
              </ExpandableSection>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StandingsTable({ rows }: { rows: GroupStanding[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'left' }}>
            <th style={{ padding: '0.35rem 0.5rem 0.5rem 0' }}>#</th>
            <th>Seleção</th>
            <th>J</th>
            <th>Pts</th>
            <th>SG</th>
            <th>GP</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.team_id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '0.65rem 0.5rem 0.65rem 0', color: row.group_position <= 2 ? 'var(--green)' : row.group_position === 3 ? 'var(--gold)' : 'var(--text-muted)', fontWeight: 700 }}>
                {row.group_position}
              </td>
              <td style={{ fontWeight: 700 }}>{row.flag} {row.team_name}</td>
              <td>{row.played}</td>
              <td>{row.points}</td>
              <td>{row.goal_difference}</td>
              <td>{row.goals_for}</td>
              <td><span className={row.group_position <= 2 ? 'badge badge-green' : row.group_position === 3 ? 'badge badge-gold' : 'badge badge-muted'}>{row.qualified_status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamsList({ teams }: { teams: WorldCupTeam[] }) {
  if (teams.length === 0) {
    return <div style={{ color: 'var(--text-muted)', paddingBottom: '0.5rem' }}>Nenhuma seleção carregada para este grupo.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
      {teams.map(team => (
        <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <span style={{ fontSize: '1.4rem' }}>{team.flag}</span>
          <span style={{ fontWeight: 700 }}>{team.name}</span>
        </div>
      ))}
    </div>
  )
}

function ThirdsTable({ rows }: { rows: BestThird[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'left' }}>
            <th style={{ padding: '0.35rem 0.5rem 0.5rem 0' }}>#</th>
            <th>Seleção</th>
            <th>Grupo</th>
            <th>Pts</th>
            <th>SG</th>
            <th>GP</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.team_id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '0.65rem 0.5rem 0.65rem 0', fontWeight: 700 }}>{row.third_rank}</td>
              <td style={{ fontWeight: 700 }}>{row.flag} {row.team_name}</td>
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
  )
}

function CupGameCard({ game }: { game: Game }) {
  return (
    <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <span className="font-ui" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {game.match_number ? `Jogo ${game.match_number} · ` : ''}{format(new Date(game.match_date), "d MMM 'às' HH:mm", { locale: ptBR })}
        </span>
        <span className={game.is_finished ? 'badge badge-green' : 'badge badge-muted'}>{game.is_finished ? 'Finalizado' : 'Aberto'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <TeamName flag={game.home_flag} name={game.home_team} align="left" />
        <div className="font-display" style={{ fontSize: '1.5rem', color: game.is_finished ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0 }}>
          {game.is_finished ? `${game.home_score} x ${game.away_score}` : 'VS'}
        </div>
        <TeamName flag={game.away_flag} name={game.away_team} align="right" />
      </div>
    </div>
  )
}

function TeamName({ flag, name, align }: { flag: string; name: string; align: 'left' | 'right' }) {
  return (
    <div style={{ minWidth: 0, flex: 1, textAlign: align }}>
      <div style={{ fontSize: '1.4rem' }}>{flag}</div>
      <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{name}</div>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="font-ui" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
      {title}
    </h2>
  )
}

function groupSummary(rows: GroupStanding[]) {
  const leader = rows[0]
  return leader ? `${leader.team_name} lidera com ${leader.points} pts` : undefined
}

function groupGamesByStage(games: Game[]) {
  const map = new Map<string, Game[]>()

  for (const game of games) {
    const list = map.get(game.stage) ?? []
    list.push(game)
    map.set(game.stage, list)
  }

  return Array.from(map, ([stage, stageGames]) => ({
    stage,
    games: stageGames.sort(sortGames),
  })).sort((a, b) => getStageOrder(a.games[0]) - getStageOrder(b.games[0]))
}

function sortGames(a: Game, b: Game) {
  return getStageOrder(a) - getStageOrder(b)
    || (a.match_number ?? 999) - (b.match_number ?? 999)
    || new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
}

function getStageOrder(game?: Game) {
  if (!game) return 999
  return game.stage_order ?? stageOrder(game.stage)
}

function stageOrder(stage: string) {
  const stages = ['Fase de Grupos', '16 avos', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Disputa 3º Lugar', 'Final']
  const index = stages.indexOf(stage)
  return index >= 0 ? (index + 1) * 10 : 999
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Carregando Copa...</span>
    </div>
  )
}

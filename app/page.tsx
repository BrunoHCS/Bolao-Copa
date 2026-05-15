'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Player, Game, Bet } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Adsense } from "@/components/Adsense";

const MEDALS = ['🥇', '🥈', '🥉']

export default function HomePage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [bets, setBets] = useState<Bet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: ps }, { data: gs }, { data: bs }] = await Promise.all([
        supabase.from('players').select('*').order('total_points', { ascending: false }),
        supabase.from('games').select('*').order('match_date', { ascending: true }),
        supabase.from('bets').select('*'),
      ])
      setPlayers(ps ?? [])
      setGames(gs ?? [])
      setBets(bs ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const upcomingGames = games.filter(g => !g.is_finished).slice(0, 4)

  if (loading) return <LoadingScreen />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      {/* Hero */}
      <div className="animate-fade-up" style={{ textAlign: 'center', paddingTop: '1rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🏆</div>
        <h1 className="font-display" style={{ fontSize: 'clamp(3rem, 8vw, 5rem)', color: 'var(--text-primary)', lineHeight: 1 }}>
          BOLÃO <span className="trophy-gradient">COPA 2026</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.75rem' }}>
          Faça seus palpites e dispute com os amigos!
        </p>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', padding: '0.75rem 1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div className="font-display" style={{ fontSize: '2rem', color: 'var(--green)' }}>{players.length}</div>
            <div className="font-ui" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Participantes</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.75rem 1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div className="font-display" style={{ fontSize: '2rem', color: 'var(--gold)' }}>{games.length}</div>
            <div className="font-ui" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jogos</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0.75rem 1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div className="font-display" style={{ fontSize: '2rem', color: 'var(--text-primary)' }}>{bets.length}</div>
            <div className="font-ui" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Palpites</div>
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>

        {/* Ranking */}
        <div className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <SectionTitle icon="🏆" title="Ranking" />
          <div className="card">
            {players.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
                <p>Nenhum participante ainda.</p>
                {/* ✅ Link estilizado — sem button aninhado */}
                <Link
                  href="/registro"
                  className="btn-primary"
                  style={{ marginTop: '1rem', fontSize: '0.85rem', padding: '0.5rem 1.25rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Cadastrar agora
                </Link>
              </div>
            ) : (
              players.map((p, i) => (
                <div key={p.id} className="rank-row" style={{
                  background: i === 0 ? 'rgba(245,197,24,0.04)' : undefined,
                  borderLeft: i === 0 ? '3px solid var(--gold)' : i === 1 ? '3px solid #c0c0c0' : i === 2 ? '3px solid #cd7f32' : '3px solid transparent',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    {i < 3
                      ? <span style={{ fontSize: '1.4rem' }}>{MEDALS[i]}</span>
                      : <span className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>{i + 1}</span>
                    }
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.display_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'Barlow Condensed', letterSpacing: '0.05em' }}>
                      @{p.username}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-display" style={{ fontSize: '1.6rem', color: i === 0 ? 'var(--gold)' : 'var(--green)' }}>{p.total_points}</div>
                    <div className="font-ui" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>pts</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Próximos jogos */}
        <div className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <SectionTitle icon="📅" title="Próximos Jogos" />
          {upcomingGames.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              <p>Todos os jogos já foram disputados!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {upcomingGames.map(game => (
                <GamePreview key={game.id} game={game} />
              ))}
              {/* ✅ Link estilizado — sem button aninhado */}
              <Link
                href="/palpites"
                className="btn-primary"
                style={{ width: '100%', marginTop: '0.5rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Ver todos e apostar →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Últimos resultados */}
      <FinishedGames games={games} bets={bets} players={players} />
      <Adsense />
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      <h2 className="font-display" style={{ fontSize: '1.6rem', color: 'var(--text-primary)' }}>{title}</h2>
    </div>
  )
}

function GamePreview({ game }: { game: Game }) {
  return (
    <div className="card" style={{ padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="font-ui" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {format(new Date(game.match_date), "d MMM 'às' HH:mm", { locale: ptBR })}
        </span>
        <span className="badge badge-muted">{game.stage}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
        <TeamDisplay flag={game.home_flag} name={game.home_team} align="left" />
        <div className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-muted)', padding: '0 0.5rem' }}>VS</div>
        <TeamDisplay flag={game.away_flag} name={game.away_team} align="right" />
      </div>
    </div>
  )
}

function TeamDisplay({ flag, name, align }: { flag: string; name: string; align: 'left' | 'right' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'left' ? 'flex-start' : 'flex-end', flex: 1 }}>
      <span style={{ fontSize: '1.8rem' }}>{flag}</span>
      <span style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '0.15rem' }}>{name}</span>
    </div>
  )
}

function FinishedGames({ games, bets, players }: { games: Game[]; bets: Bet[]; players: Player[] }) {
  const finished = games.filter(g => g.is_finished)
  if (finished.length === 0) return null

  return (
    <div className="animate-fade-up" style={{ animationDelay: '0.3s' }}>
      <SectionTitle icon="✅" title="Resultados" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {finished.map(game => {
          const gameBets = bets.filter(b => b.game_id === game.id)
          const exact = gameBets.filter(b => b.points === 3).length
          const correct = gameBets.filter(b => b.points === 1).length
          return (
            <div key={game.id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="badge badge-green">✓ Finalizado</span>
                <span className="font-ui" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  {format(new Date(game.match_date), "d MMM", { locale: ptBR })}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{game.home_flag}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{game.home_team}</span>
                </div>
                <div className="font-display" style={{ fontSize: '2rem', color: 'var(--green)', padding: '0 0.75rem' }}>
                  {game.home_score} — {game.away_score}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{game.away_team}</span>
                  <span style={{ fontSize: '1.5rem' }}>{game.away_flag}</span>
                </div>
              </div>
              {gameBets.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-gold">🎯 {exact} placar exato</span>
                  <span className="badge badge-muted">✓ {correct} resultado</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
      <div style={{ fontSize: '3rem', animation: 'spin 1s linear infinite' }}>⚽</div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <p className="font-ui" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.9rem' }}>Carregando...</p>
    </div>
  )
}

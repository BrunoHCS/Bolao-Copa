'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, Player, Group } from '@/lib/supabase'

type MemberWithPoints = Player & { joined_at: string }

export default function GroupDetailPage() {
  const params = useParams()
  const groupId = params.id as string
  const router = useRouter()

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<MemberWithPoints[]>([])
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [showConfirmLeave, setShowConfirmLeave] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (!isMounted) return

        if (sessionError || !session) {
          router.push('/login')
          return
        }

        const { data: playerData, error: playerError } = await supabase
          .from('players').select('*').eq('id', session.user.id).single()

        if (!isMounted) return

        if (playerError || !playerData) {
          router.push('/login')
          return
        }

        setCurrentPlayer(playerData)

        const { data: groupData, error: groupError } = await supabase
          .from('groups').select('*').eq('id', groupId).single()

        if (!isMounted) return

        if (groupError || !groupData) {
          router.push('/grupos')
          return
        }

        setGroup(groupData)

        const { data: memberships, error: membErr } = await supabase
          .from('group_members')
          .select('player_id, joined_at')
          .eq('group_id', groupId)

        if (!isMounted) return

        if (membErr) {
          console.error('Erro ao carregar membros:', membErr)
          return
        }

        if (!memberships?.length) return

        const playerIds = memberships.map(m => m.player_id)
        const { data: playersData, error: playersErr } = await supabase
          .from('players')
          .select('*')
          .in('id', playerIds)
          .order('total_points', { ascending: false })

        if (!isMounted) return

        if (playersErr) {
          console.error('Erro ao carregar jogadores do grupo:', playersErr)
          return
        }

        const joinedAtMap: Record<string, string> = {}
        for (const m of memberships) joinedAtMap[m.player_id] = m.joined_at

        setMembers((playersData ?? []).map(p => ({ ...p, joined_at: joinedAtMap[p.id] ?? '' })))
      } catch (err) {
        console.error('Erro inesperado ao carregar grupo:', err)
        if (isMounted) router.push('/grupos')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [groupId])

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
  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <div className="animate-fade-up">
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/grupos" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'Barlow Condensed', letterSpacing: '0.05em' }}>
          ← Meus grupos
        </Link>
      </div>

      {/* Header do grupo */}
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
            Compartilhe o nome <strong style={{ color: 'var(--text-primary)' }}>"{group.name}"</strong> e a senha do grupo. Eles entram em <strong style={{ color: 'var(--green)' }}>Grupos → Entrar em grupo</strong>.
          </p>
        </div>
        <button onClick={handleCopyName} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', whiteSpace: 'nowrap' }}>
          {copyMsg || '📋 Copiar nome'}
        </button>
      </div>

      {/* Ranking */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🏆</span>
          <h2 className="font-display" style={{ fontSize: '1.6rem' }}>
            Ranking do Grupo
          </h2>
          <span className="badge badge-muted" style={{ marginLeft: '0.25rem' }}>{members.length} participante{members.length !== 1 ? 's' : ''}</span>
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

      {/* Confirm leave modal */}
      {showConfirmLeave && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowConfirmLeave(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '380px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚪</div>
            <h3 className="font-display" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Sair do grupo?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Você vai sair de <strong style={{ color: 'var(--text-primary)' }}>"{group.name}"</strong>. Para voltar vai precisar da senha novamente.
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

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Carregando grupo...</span>
    </div>
  )
}
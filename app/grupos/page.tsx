'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Player, Group } from '@/lib/supabase'
import { clearLocalAuthState, getCurrentSessionSafe, getPlayerForSessionSafe } from '@/lib/auth'

type GroupWithMeta = Group & { member_count: number; is_owner: boolean }
type Modal = 'none' | 'create' | 'join'

export default function GruposPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [groups, setGroups] = useState<GroupWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>('none')
  const router = useRouter()

  const loadGroups = useCallback(async (playerId: string, isMounted = true) => {
    try {
      const { data: memberships, error: membErr } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('player_id', playerId)

      if (!isMounted) return
      if (membErr) { console.error('Erro ao carregar memberships:', membErr); return }
      if (!memberships?.length) { setGroups([]); return }

      const groupIds = memberships.map(m => m.group_id)

      const { data: groupsData, error: groupsErr } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false })

      if (!isMounted) return
      if (groupsErr) { console.error('Erro ao carregar grupos:', groupsErr); return }
      if (!groupsData) { setGroups([]); return }

      const { data: allMembers } = await supabase
        .from('group_members')
        .select('group_id, player_id')
        .in('group_id', groupIds)

      if (!isMounted) return

      const countMap: Record<string, number> = {}
      for (const m of allMembers ?? []) {
        countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1
      }

      setGroups(groupsData.map(g => ({
        ...g,
        member_count: countMap[g.id] ?? 0,
        is_owner: g.owner_id === playerId,
      })))
    } catch (err) {
      console.error('Erro inesperado ao carregar grupos:', err)
    }
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

        const session = sessionResult.data
        const playerResult = await getPlayerForSessionSafe(session)

        if (!isMounted) return

        if (playerResult.error || !playerResult.data) {
          setLoading(false)
          router.push('/login')
          return
        }

        setPlayer(playerResult.data)
        await loadGroups(session.user.id, isMounted)
      } catch (err) {
        console.error('Erro ao carregar grupos:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => { isMounted = false }
  }, [loadGroups, router])

  const handleGroupCreated = async (groupId: string) => {
    setModal('none')
    if (player) await loadGroups(player.id)
    router.push(`/grupos/${groupId}`)
  }

  const handleGroupJoined = async () => {
    setModal('none')
    if (player) await loadGroups(player.id)
  }

  if (loading) return <Loading />

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '2.5rem' }}>
            Meus <span className="green-gradient">Grupos</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Dispute com grupos de amigos separados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-outline" onClick={() => setModal('join')}>🔍 Entrar em grupo</button>
          <button className="btn-primary" onClick={() => setModal('create')}>➕ Criar grupo</button>
        </div>
      </div>

      {/* Lista de grupos */}
      {groups.length === 0 ? (
        <EmptyState onCreate={() => setModal('create')} onJoin={() => setModal('join')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {groups.map(g => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal === 'create' && (
        <CreateGroupModal
          onClose={() => setModal('none')}
          onCreated={handleGroupCreated}
        />
      )}
      {modal === 'join' && (
        <JoinGroupModal
          onClose={() => setModal('none')}
          onJoined={handleGroupJoined}
        />
      )}
    </div>
  )
}

function GroupCard({ group }: { group: GroupWithMeta }) {
  return (
    <Link href={`/grupos/${group.id}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>👥</span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {group.is_owner && <span className="badge badge-gold">👑 Criador</span>}
            <span className="badge badge-muted">{group.member_count} membro{group.member_count !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.35rem' }}>{group.name}</h3>
        {group.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {group.description}
          </p>
        )}
        <div style={{ color: 'var(--green)', fontSize: '0.8rem', fontFamily: 'Barlow Condensed', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginTop: '0.5rem' }}>
          Ver ranking →
        </div>
      </div>
    </Link>
  )
}

function EmptyState({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
      <h2 className="font-display" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Nenhum grupo ainda</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Crie um grupo para competir com seus amigos separadamente, ou entre em um grupo existente com a senha.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-outline" onClick={onJoin}>🔍 Entrar em grupo</button>
        <button className="btn-primary" onClick={onCreate}>➕ Criar meu grupo</button>
      </div>
    </div>
  )
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (name.trim().length < 3) { setError('Nome deve ter ao menos 3 caracteres.'); return }
    if (password.length < 4) { setError('Senha deve ter ao menos 4 caracteres.'); return }
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }

    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_group', {
        group_name: name.trim(),
        group_description: description.trim() || null,
        group_password: password,
      })
      if (rpcError) { setError(rpcError.message); return }
      onCreated(data as string)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="font-display" style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>
        ➕ Criar <span className="green-gradient">Grupo</span>
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Só quem tiver a senha pode entrar no seu grupo.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Field label="Nome do grupo">
          <input className="input" placeholder="Ex: Galera do Trabalho" value={name} onChange={e => setName(e.target.value)} required maxLength={50} />
        </Field>
        <Field label="Descrição (opcional)">
          <input className="input" placeholder="Ex: Bolão dos colegas do escritório" value={description} onChange={e => setDescription(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Senha do grupo">
          <input className="input" type="password" placeholder="Mínimo 4 caracteres" value={password} onChange={e => setPassword(e.target.value)} required />
        </Field>
        <Field label="Confirmar senha">
          <input className="input" type="password" placeholder="Repita a senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2 }}>
            {loading ? 'Criando...' : '➕ Criar grupo'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}

function JoinGroupModal({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const [searchName, setSearchName] = useState('')
  const [foundGroup, setFoundGroup] = useState<{ id: string; name: string; description: string | null; member_count: number } | null>(null)
  const [searching, setSearching] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [searchError, setSearchError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearchError('')
    setFoundGroup(null)
    setPassword('')
    setError('')
    if (!searchName.trim()) return
    setSearching(true)
    try {
      const { data } = await supabase.rpc('search_group_by_name', { search_name: searchName.trim() })
      if (!data?.length) { setSearchError('Nenhum grupo encontrado com esse nome.'); return }
      setFoundGroup(data[0])
    } finally {
      setSearching(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!foundGroup || !password) return
    setJoining(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('join_group', {
        group_id_param: foundGroup.id,
        group_password: password,
      })

      if (rpcError) {
        setError(rpcError.message ?? 'Erro ao entrar no grupo.')
        return
      }

      const result = data as { success: boolean; error?: string; group_name?: string }
      if (!result?.success) {
        setError(result?.error ?? 'Erro ao entrar no grupo.')
        return
      }

      onJoined()
    } finally {
      setJoining(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="font-display" style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>
        🔍 Entrar em <span className="trophy-gradient">Grupo</span>
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Busque pelo nome exato do grupo e insira a senha.
      </p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          className="input"
          placeholder="Nome do grupo..."
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary" disabled={searching} style={{ whiteSpace: 'nowrap', padding: '0.75rem 1rem' }}>
          {searching ? '...' : 'Buscar'}
        </button>
      </form>

      {searchError && <ErrorBox>{searchError}</ErrorBox>}

      {foundGroup && (
        <div>
          <div style={{ background: 'rgba(0,214,79,0.07)', border: '1px solid rgba(0,214,79,0.25)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>👥 {foundGroup.name}</div>
                {foundGroup.description && <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>{foundGroup.description}</div>}
              </div>
              <span className="badge badge-muted">{foundGroup.member_count} membro{foundGroup.member_count !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Field label="Senha do grupo">
              <input className="input" type="password" placeholder="Digite a senha" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
            </Field>
            {error && <ErrorBox>{error}</ErrorBox>}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
              <button type="submit" className="btn-gold" disabled={joining} style={{ flex: 2 }}>
                {joining ? 'Entrando...' : '🏆 Entrar no grupo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!foundGroup && !searchError && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
        </div>
      )}
    </ModalOverlay>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
    >
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '480px', padding: '2rem', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-ui" style={{ fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--red)', fontSize: '0.9rem' }}>
      ⚠️ {children}
    </div>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'Barlow Condensed', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Carregando grupos...</span>
    </div>
  )
}

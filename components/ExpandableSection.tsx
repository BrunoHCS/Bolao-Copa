'use client'

import { useEffect, useId, useState } from 'react'

type ExpandableSectionProps = {
  title: string
  count?: number | string
  subtitle?: string
  children: React.ReactNode
  defaultOpen?: boolean
  mobileDefaultOpen?: boolean
}

export function ExpandableSection({
  title,
  count,
  subtitle,
  children,
  defaultOpen = true,
  mobileDefaultOpen = false,
}: ExpandableSectionProps) {
  const contentId = useId()
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const syncOpen = () => setOpen(media.matches ? mobileDefaultOpen : defaultOpen)

    syncOpen()
    media.addEventListener('change', syncOpen)
    return () => media.removeEventListener('change', syncOpen)
  }, [defaultOpen, mobileDefaultOpen])

  return (
    <section className="expandable-section">
      <button
        type="button"
        className="expandable-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(prev => !prev)}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
          <span className="font-display expandable-title">{title}</span>
          {subtitle && <span className="expandable-subtitle">{subtitle}</span>}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {count !== undefined && <span className="badge badge-muted">{count}</span>}
          <span className="expandable-chevron" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▾
          </span>
        </span>
      </button>
      {open && (
        <div id={contentId} className="expandable-content">
          {children}
        </div>
      )}
    </section>
  )
}

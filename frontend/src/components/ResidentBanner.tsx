import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { ResidentInfo } from '../types'

interface ResidentBannerProps {
  theme: ThemeColors
  resident: ResidentInfo
}

export default function ResidentBanner({ theme, resident }: ResidentBannerProps) {
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const nights = resident.nights.length

  const banner: CSSProperties = {
    background: theme.surface,
    border: `2px solid ${theme.primary}`,
    borderRadius: 8,
    padding: '16px 20px',
    marginBottom: 24,
  }

  const title: CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: theme.text,
    marginBottom: 4,
  }

  const detail: CSSProperties = {
    fontSize: 14,
    color: theme.textSecondary,
  }

  const firstName = resident.guest_name.split(' ')[0] || resident.guest_name

  return (
    <div style={banner}>
      <div style={title}>Welcome, {firstName}</div>
      <div style={detail}>
        {resident.room && <span>Room {resident.room} &middot; </span>}
        {nights} {nights === 1 ? 'night' : 'nights'}: {formatDate(resident.check_in)} &ndash; {formatDate(resident.check_out)}
      </div>
    </div>
  )
}

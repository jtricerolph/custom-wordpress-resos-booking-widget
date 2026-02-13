import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import { styles } from '../utils/theme'

interface BookingConfirmationProps {
  theme: ThemeColors
  phone: string
  periodName: string
  date: string
  time: string
  people: number
  email: string
  bookingId: string
  onNewBooking: () => void
}

export default function BookingConfirmation({
  theme, phone, periodName, date, time, people, email, bookingId, onNewBooking,
}: BookingConfirmationProps) {
  const s = styles(theme)

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function formatTime(t: string): string {
    const [h, m] = t.split(':')
    const hour = parseInt(h, 10)
    if (hour >= 12) {
      const h12 = hour === 12 ? 12 : hour - 12
      return `${h12}:${m} PM`
    }
    const h12 = hour === 0 ? 12 : hour
    return `${h12}:${m} AM`
  }

  const detailRow: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: `1px solid ${theme.border}`,
    fontSize: 14,
  }

  const detailLabel: CSSProperties = {
    color: theme.textSecondary,
    fontWeight: 500,
  }

  const detailValue: CSSProperties = {
    color: theme.text,
    fontWeight: 600,
  }

  return (
    <div style={s.successCard} role="status" aria-live="polite">
      <div style={{ fontSize: 28, marginBottom: 8 }} aria-hidden="true">&#10003;</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
        Booking Confirmed
      </div>
      <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 20 }}>
        Reference: {bookingId}
      </div>

      <div style={{ textAlign: 'left' as const, marginBottom: 20 }}>
        {periodName && (
          <div style={detailRow}>
            <span style={detailLabel}>Service</span>
            <span style={detailValue}>{periodName}</span>
          </div>
        )}
        <div style={detailRow}>
          <span style={detailLabel}>Date</span>
          <span style={detailValue}>{formatDate(date)}</span>
        </div>
        <div style={detailRow}>
          <span style={detailLabel}>Time</span>
          <span style={detailValue}>{formatTime(time)}</span>
        </div>
        <div style={{ ...detailRow, borderBottom: 'none' }}>
          <span style={detailLabel}>Guests</span>
          <span style={detailValue}>{people}</span>
        </div>
      </div>

      <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
        A confirmation email has been sent to <strong>{email}</strong>.
        <br />
        To modify or cancel your booking, use the link in your email or call{' '}
        <a href={`tel:${phone}`} style={{ color: theme.primary, textDecoration: 'none' }}>{phone}</a>.
      </div>

      <button
        type="button"
        style={{ ...s.button, fontSize: 14 }}
        onClick={onNewBooking}
        onMouseEnter={(e) => {
          Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })
        }}
        onMouseLeave={(e) => {
          Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })
        }}
      >
        Make another booking
      </button>
    </div>
  )
}

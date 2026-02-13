import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { BatchBookingResult } from '../types'
import { styles } from '../utils/theme'

interface BookingBatchConfirmationProps {
  theme: ThemeColors
  phone: string
  email: string
  results: BatchBookingResult[]
  noTableDates: string[]
  onNewBooking: () => void
}

export default function BookingBatchConfirmation({
  theme, phone, email, results, noTableDates, onNewBooking,
}: BookingBatchConfirmationProps) {
  const s = styles(theme)

  const succeeded = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const row: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: `1px solid ${theme.border}`,
    fontSize: 14,
  }

  return (
    <div style={s.successCard}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>&#10003;</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
        {succeeded.length} {succeeded.length === 1 ? 'Booking' : 'Bookings'} Confirmed
      </div>

      {succeeded.length > 0 && (
        <div style={{ textAlign: 'left' as const, marginBottom: 16, marginTop: 16 }}>
          {succeeded.map(r => (
            <div key={r.date} style={row}>
              <span style={{ color: theme.textSecondary }}>{formatDate(r.date)}</span>
              <span style={{ color: theme.success, fontWeight: 500 }}>Ref: {r.booking_id}</span>
            </div>
          ))}
        </div>
      )}

      {failed.length > 0 && (
        <div style={{ ...s.errorMessage, margin: '12px 0', textAlign: 'left' as const }}>
          {failed.length} {failed.length === 1 ? 'booking' : 'bookings'} could not be created.
          Please call <a href={`tel:${phone}`} style={{ color: theme.error }}>{phone}</a> for assistance.
        </div>
      )}

      {noTableDates.length > 0 && (
        <div style={{ ...s.infoMessage, margin: '12px 0', textAlign: 'left' as const }}>
          <strong>No table needed:</strong>{' '}
          {noTableDates.map(d => formatDate(d)).join(', ')}
        </div>
      )}

      <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
        Confirmation emails have been sent to <strong>{email}</strong>.
        <br />
        To modify or cancel, use the links in your emails or call{' '}
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
        Done
      </button>
    </div>
  )
}

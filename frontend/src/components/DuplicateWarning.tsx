import type { ThemeColors } from '../utils/theme'
import type { DuplicateCheckResult } from '../types'
import { styles } from '../utils/theme'

interface DuplicateWarningProps {
  theme: ThemeColors
  duplicate: DuplicateCheckResult
  onCancel: () => void
  onProceed: () => void
}

export default function DuplicateWarning({ theme, duplicate, onCancel, onProceed }: DuplicateWarningProps) {
  const s = styles(theme)

  function formatTime(time: string): string {
    const [h, m] = time.split(':')
    const hour = parseInt(h, 10)
    if (hour >= 12) {
      const h12 = hour === 12 ? 12 : hour - 12
      return `${h12}:${m} PM`
    }
    const h12 = hour === 0 ? 12 : hour
    return `${h12}:${m} AM`
  }

  return (
    <div style={{ ...s.infoMessage, borderColor: theme.accent, margin: '16px 0' }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: theme.text }}>
        Existing booking found
      </div>
      <div style={{ marginBottom: 16, fontSize: 14 }}>
        You already have a booking at {formatTime(duplicate.existing_time)} for{' '}
        {duplicate.existing_people} {duplicate.existing_people === 1 ? 'guest' : 'guests'} on this date.
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={s.primaryButton}
          onClick={onCancel}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = theme.primaryHover
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = theme.primary
          }}
        >
          That's my booking
        </button>
        <button
          type="button"
          style={{ ...s.button, fontSize: 14 }}
          onClick={onProceed}
          onMouseEnter={(e) => {
            Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })
          }}
          onMouseLeave={(e) => {
            Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })
          }}
        >
          I need an additional booking
        </button>
      </div>
    </div>
  )
}

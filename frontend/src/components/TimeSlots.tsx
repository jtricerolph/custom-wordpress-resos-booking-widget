import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import { styles } from '../utils/theme'

interface TimeSlotsProps {
  theme: ThemeColors
  times: string[]
  selectedTime: string | null
  loading: boolean
  onTimeSelect: (time: string) => void
}

export default function TimeSlots({ theme, times, selectedTime, loading, onTimeSelect }: TimeSlotsProps) {
  const s = styles(theme)

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <div style={s.spinner} />
      </div>
    )
  }

  if (times.length === 0) {
    return (
      <div style={{ ...s.infoMessage, margin: '8px 0' }}>
        No available times for this period.
      </div>
    )
  }

  const gridStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '8px 0',
  }

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
    <div style={gridStyle}>
      {times.map(time => {
        const isSelected = time === selectedTime
        return (
          <button
            key={time}
            style={{
              ...s.button,
              ...(isSelected ? s.buttonSelected : {}),
              fontSize: 13,
              padding: '6px 12px',
            }}
            onClick={() => onTimeSelect(time)}
            onMouseEnter={(e) => {
              if (!isSelected) {
                Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })
              }
            }}
          >
            {formatTime(time)}
          </button>
        )
      })}
    </div>
  )
}

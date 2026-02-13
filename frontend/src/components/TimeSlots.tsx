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
    // Skeleton placeholder — 6 pill-shaped blocks
    const skeletonStyle: CSSProperties = {
      width: 72,
      height: 36,
      borderRadius: 6,
      background: theme.border,
      opacity: 0.4,
      animation: 'rbw-pulse 1.2s ease-in-out infinite',
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }} aria-busy="true" aria-label="Loading available times">
        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ ...skeletonStyle, animationDelay: `${i * 0.1}s` }} />)}
      </div>
    )
  }

  if (times.length === 0) {
    return (
      <div style={{ ...s.infoMessage, margin: '8px 0' }} role="status">
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
    <div style={gridStyle} role="group" aria-label="Available times">
      {times.map(time => {
        const isSelected = time === selectedTime
        const displayTime = formatTime(time)
        return (
          <button
            key={time}
            aria-pressed={isSelected}
            aria-label={`Book at ${displayTime}`}
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
            {displayTime}
          </button>
        )
      })}
    </div>
  )
}

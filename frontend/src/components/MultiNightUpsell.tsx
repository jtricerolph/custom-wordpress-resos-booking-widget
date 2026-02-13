import { useState } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { ResidentMatchResult } from '../types'

interface MultiNightUpsellProps {
  theme: ThemeColors
  match: ResidentMatchResult
  selectedDate: string
  selectedTime: string
  selectedPeriodName: string
  people: number
  onNightsSelected: (nights: string[]) => void
}

export default function MultiNightUpsell({
  theme, match, selectedDate, selectedTime, selectedPeriodName, people,
  onNightsSelected,
}: MultiNightUpsellProps) {
  const nights = (match.nights || []).filter(n => n !== selectedDate)

  const [checked, setChecked] = useState<Record<string, boolean>>({})

  if (nights.length === 0) return null

  function toggleNight(date: string) {
    const next = { ...checked, [date]: !checked[date] }
    setChecked(next)
    onNightsSelected(Object.keys(next).filter(k => next[k]))
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
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

  const sectionStyle = {
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    background: theme.background,
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 14, fontWeight: 500, color: theme.text, marginBottom: 12 }}>
        Would you like a similar time on other nights of your stay?
      </div>
      {nights.map(date => {
        const isChecked = checked[date] || false
        return (
          <label
            key={date}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              cursor: 'pointer',
              fontSize: 13,
              color: theme.text,
            }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleNight(date)}
              style={{ accentColor: theme.primary }}
            />
            <span>{formatDate(date)}</span>
            <span style={{ color: theme.textSecondary }}>
              {selectedPeriodName} {formatTime(selectedTime)} &times;{people} guests
            </span>
          </label>
        )
      })}
    </div>
  )
}

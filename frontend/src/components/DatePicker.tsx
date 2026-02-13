import { useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'

interface DatePickerProps {
  theme: ThemeColors
  maxBookingWindow: number
  selectedDate: string | null
  onDateSelect: (date: string) => void
}

export default function DatePicker({ theme, maxBookingWindow, selectedDate, onDateSelect }: DatePickerProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewDate, setViewDate] = useState(new Date(today))
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  const maxDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + maxBookingWindow)
    return d
  }, [maxBookingWindow])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7 // Monday=0

  const dayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  function formatDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function formatDateLabel(d: Date): string {
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function prevMonth() {
    const d = new Date(year, month - 1, 1)
    if (d >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setViewDate(d)
    }
  }

  function nextMonth() {
    const d = new Date(year, month + 1, 1)
    if (d <= maxDate) {
      setViewDate(d)
    }
  }

  function selectMonth(m: number) {
    setViewDate(new Date(year, m, 1))
    setShowMonthPicker(false)
  }

  const s: Record<string, CSSProperties> = {
    wrapper: { marginBottom: 16 },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    },
    navBtn: {
      background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
      color: theme.text, padding: '4px 8px', borderRadius: 4,
      minWidth: 36, minHeight: 36,
    },
    monthLabel: {
      fontSize: 16, fontWeight: 600, cursor: 'pointer', color: theme.text,
      padding: '4px 8px', borderRadius: 4,
    },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
      textAlign: 'center',
    },
    dayHeader: {
      fontSize: 12, fontWeight: 600, color: theme.textSecondary, padding: '4px 0',
    },
    dayCell: {
      padding: '8px 0', borderRadius: 6, fontSize: 14, cursor: 'pointer',
      border: 'none', background: 'transparent', color: theme.text,
      minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.15s ease',
    },
    dayDisabled: {
      color: theme.border, cursor: 'default',
    },
    daySelected: {
      background: theme.primary, color: '#FFFFFF', fontWeight: 600,
    },
    dayToday: {
      fontWeight: 700,
    },
    monthGrid: {
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      padding: 8,
    },
    monthBtn: {
      padding: '8px 4px', borderRadius: 6, border: `1px solid ${theme.border}`,
      background: theme.surface, color: theme.text, cursor: 'pointer', fontSize: 13,
      minHeight: 36,
    },
    monthBtnDisabled: {
      color: theme.border, cursor: 'default', background: theme.background,
    },
  }

  if (showMonthPicker) {
    return (
      <div style={s.wrapper} role="grid" aria-label="Month picker">
        <div style={s.header}>
          <button style={s.navBtn} onClick={() => setViewDate(new Date(year - 1, month, 1))} aria-label="Previous year">&lt;</button>
          <button style={{ ...s.monthLabel, border: 'none', background: 'none' }} onClick={() => setShowMonthPicker(false)} aria-label="Close month picker">{year}</button>
          <button style={s.navBtn} onClick={() => setViewDate(new Date(year + 1, month, 1))} aria-label="Next year">&gt;</button>
        </div>
        <div style={s.monthGrid} role="group" aria-label="Months">
          {monthNames.map((name, i) => {
            const monthStart = new Date(year, i, 1)
            const monthEnd = new Date(year, i + 1, 0)
            const disabled = monthEnd < today || monthStart > maxDate
            return (
              <button
                key={i}
                style={{ ...s.monthBtn, ...(disabled ? s.monthBtnDisabled : {}) }}
                disabled={disabled}
                onClick={() => !disabled && selectMonth(i)}
                aria-label={`${name} ${year}`}
              >
                {name.substring(0, 3)}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const cells: JSX.Element[] = []

  // Empty cells before first day
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<div key={`empty-${i}`} />)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = formatDate(date)
    const isPast = date < today
    const isFuture = date > maxDate
    const disabled = isPast || isFuture
    const isToday = dateStr === formatDate(today)
    const isSelected = dateStr === selectedDate

    const cellStyle: CSSProperties = {
      ...s.dayCell,
      ...(isToday ? s.dayToday : {}),
      ...(disabled ? s.dayDisabled : {}),
      ...(isSelected ? s.daySelected : {}),
    }

    cells.push(
      <button
        key={day}
        style={cellStyle}
        disabled={disabled}
        aria-label={formatDateLabel(date)}
        aria-pressed={isSelected}
        aria-current={isToday ? 'date' : undefined}
        onClick={() => !disabled && onDateSelect(dateStr)}
        onMouseEnter={(e) => {
          if (!disabled && !isSelected) {
            (e.target as HTMLElement).style.background = theme.background
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isSelected) {
            (e.target as HTMLElement).style.background = 'transparent'
          }
        }}
      >
        {day}
      </button>
    )
  }

  return (
    <div style={s.wrapper} role="grid" aria-label={`Calendar for ${monthNames[month]} ${year}`}>
      <div style={s.header}>
        <button style={s.navBtn} onClick={prevMonth} aria-label="Previous month">&lt;</button>
        <button style={{ ...s.monthLabel, border: 'none', background: 'none' }} onClick={() => setShowMonthPicker(true)} aria-label="Pick a month">
          {monthNames[month]} {year}
        </button>
        <button style={s.navBtn} onClick={nextMonth} aria-label="Next month">&gt;</button>
      </div>
      <div style={s.grid} role="row">
        {dayNames.map((d, i) => <div key={d} style={s.dayHeader} role="columnheader" aria-label={fullDayNames[i]}>{d}</div>)}
        {cells}
      </div>
    </div>
  )
}

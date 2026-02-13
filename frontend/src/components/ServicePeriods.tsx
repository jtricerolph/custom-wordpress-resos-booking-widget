import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { OpeningHourPeriod, CustomFieldDef } from '../types'
import { useBookingApi } from '../hooks/useBookingApi'
import TimeSlots from './TimeSlots'
import ClosedMessage from './ClosedMessage'

interface ServicePeriodsProps {
  theme: ThemeColors
  phone: string
  periods: OpeningHourPeriod[]
  date: string
  people: number
  selectedPeriodId: string | null
  selectedTime: string | null
  onPeriodSelect: (periodId: string) => void
  onTimeSelect: (time: string, customFields: CustomFieldDef[]) => void
}

interface PeriodData {
  times: string[]
  customFields: CustomFieldDef[]
  loading: boolean
  loaded: boolean
}

export default function ServicePeriods({
  theme, phone, periods, date, people,
  selectedPeriodId, selectedTime,
  onPeriodSelect, onTimeSelect,
}: ServicePeriodsProps) {
  const api = useBookingApi()
  const [periodData, setPeriodData] = useState<Record<string, PeriodData>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Auto-expand the last period with potential availability (typically Dinner)
  useEffect(() => {
    if (periods.length > 0 && !expandedId) {
      // Find the last non-closed period
      const available = periods.filter(p => !p.resident_only && !p.display_message)
      const target = available.length > 0 ? available[available.length - 1] : periods[periods.length - 1]
      setExpandedId(target.id)
    }
  }, [periods, expandedId])

  const loadPeriodData = useCallback(async (periodId: string) => {
    const current = periodData[periodId]
    if (current?.loaded || current?.loading) return

    setPeriodData(prev => ({
      ...prev,
      [periodId]: { times: [], customFields: [], loading: true, loaded: false },
    }))

    try {
      const result = await api.fetchAvailableTimes(date, people, periodId)
      setPeriodData(prev => ({
        ...prev,
        [periodId]: {
          times: result.times,
          customFields: result.activeCustomFields,
          loading: false,
          loaded: true,
        },
      }))
    } catch {
      setPeriodData(prev => ({
        ...prev,
        [periodId]: { times: [], customFields: [], loading: false, loaded: true },
      }))
    }
  }, [api, date, people, periodData])

  // Load data when a period is expanded
  useEffect(() => {
    if (expandedId) {
      loadPeriodData(expandedId)
    }
  }, [expandedId, loadPeriodData])

  function togglePeriod(periodId: string) {
    if (expandedId === periodId) {
      setExpandedId(null)
    } else {
      setExpandedId(periodId)
      onPeriodSelect(periodId)
    }
  }

  function handleTimeSelect(periodId: string, time: string) {
    const data = periodData[periodId]
    onTimeSelect(time, data?.customFields || [])
  }

  const s: Record<string, CSSProperties> = {
    wrapper: { marginBottom: 8 },
    period: {
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      cursor: 'pointer',
      background: theme.surface,
      borderBottom: 'none',
      fontSize: 14,
      fontWeight: 500,
      color: theme.text,
    },
    headerExpanded: {
      borderBottom: `1px solid ${theme.border}`,
    },
    chevron: {
      fontSize: 12,
      color: theme.textSecondary,
      transition: 'transform 0.2s ease',
    },
    content: {
      padding: '8px 16px 16px',
      background: theme.background,
    },
    periodName: {
      flex: 1,
    },
    periodTime: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 8,
    },
  }

  return (
    <div style={s.wrapper}>
      {periods.map(period => {
        const isExpanded = expandedId === period.id
        const data = periodData[period.id]
        const isClosed = period.resident_only || !!period.display_message

        return (
          <div key={period.id} style={s.period} role="region" aria-label={period.name}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-controls={`rbw-period-${period.id}`}
              style={{ ...s.header, ...(isExpanded ? s.headerExpanded : {}) }}
              onClick={() => togglePeriod(period.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePeriod(period.id) } }}
            >
              <span style={s.periodName}>
                {period.name}
              </span>
              <span style={s.periodTime}>
                {period.from} – {period.to}
              </span>
              <span style={{ ...s.chevron, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }} aria-hidden="true">
                ▼
              </span>
            </div>
            {isExpanded && (
              <div id={`rbw-period-${period.id}`} style={s.content} role="region">
                {isClosed && !period.resident_only ? (
                  <ClosedMessage theme={theme} message={period.display_message} phone={phone} />
                ) : period.resident_only ? (
                  <ClosedMessage
                    theme={theme}
                    message={period.display_message}
                    phone={phone}
                    residentOnly
                  />
                ) : (
                  <TimeSlots
                    theme={theme}
                    times={data?.times || []}
                    selectedTime={selectedPeriodId === period.id ? selectedTime : null}
                    loading={data?.loading ?? true}
                    onTimeSelect={(time) => handleTimeSelect(period.id, time)}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

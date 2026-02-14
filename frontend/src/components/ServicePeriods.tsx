import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { OpeningHourPeriod, CustomFieldDef, TimeSlotResponse } from '../types'
import TimeSlots from './TimeSlots'
import ClosedMessage from './ClosedMessage'

interface ServicePeriodsProps {
  theme: ThemeColors
  phone: string
  periods: OpeningHourPeriod[]
  allPeriodTimes: Record<string, TimeSlotResponse>
  date: string
  people: number
  selectedPeriodId: string | null
  selectedTime: string | null
  onPeriodSelect: (periodId: string) => void
  onTimeSelect: (time: string, customFields: CustomFieldDef[]) => void
}

export default function ServicePeriods({
  theme, phone, periods, allPeriodTimes,
  selectedPeriodId, selectedTime,
  onPeriodSelect, onTimeSelect,
}: ServicePeriodsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const hasPreloadedTimes = Object.keys(allPeriodTimes).length > 0

  console.log('[RBW] ServicePeriods render — hasPreloadedTimes:', hasPreloadedTimes, 'periods:', periods.length, 'allPeriodTimes keys:', Object.keys(allPeriodTimes))

  // Auto-expand the last period that has available times
  useEffect(() => {
    if (periods.length > 0 && !expandedId) {
      if (hasPreloadedTimes) {
        // Find the last period that has times in the preloaded data
        const withTimes = periods.filter(p => {
          const data = allPeriodTimes[p.id]
          return data && data.times.length > 0
        })
        const target = withTimes.length > 0 ? withTimes[withTimes.length - 1] : periods[periods.length - 1]
        setExpandedId(target.id)
      } else {
        // Fallback: find last non-closed period
        const available = periods.filter(p => !p.resident_only && !p.display_message)
        const target = available.length > 0 ? available[available.length - 1] : periods[periods.length - 1]
        setExpandedId(target.id)
      }
    }
  }, [periods, expandedId, hasPreloadedTimes, allPeriodTimes])

  function togglePeriod(periodId: string) {
    if (expandedId === periodId) {
      setExpandedId(null)
    } else {
      setExpandedId(periodId)
      onPeriodSelect(periodId)
    }
  }

  function handleTimeSelect(periodId: string, time: string) {
    const data = allPeriodTimes[periodId]
    onTimeSelect(time, data?.activeCustomFields || [])
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
        const preloaded = allPeriodTimes[period.id]

        // A period is closed if:
        // 1. It has closeout markers (resident_only or display_message from openingHours), OR
        // 2. bookingFlow/times didn't include it (not in allPeriodTimes) when we have preloaded data
        const hasCloseoutMarker = period.resident_only || !!period.display_message
        const notInBookingFlow = hasPreloadedTimes && !preloaded
        const isClosed = hasCloseoutMarker || notInBookingFlow
        console.log(`[RBW]   Period "${period.name}" (${period.id}): marker=${hasCloseoutMarker} notInFlow=${notInBookingFlow} closed=${isClosed} times=${preloaded?.times?.length ?? 'none'}`)

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
                {isClosed ? (
                  <ClosedMessage
                    theme={theme}
                    message={period.display_message}
                    phone={phone}
                    residentOnly={period.resident_only || undefined}
                  />
                ) : (
                  <TimeSlots
                    theme={theme}
                    times={preloaded?.times || []}
                    selectedTime={selectedPeriodId === period.id ? selectedTime : null}
                    loading={!hasPreloadedTimes}
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

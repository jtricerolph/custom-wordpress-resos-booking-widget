import { useState, useEffect, memo } from 'react'
import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { CustomFieldDef, PeriodData } from '../types'
import TimeSlots from './TimeSlots'
import ClosedMessage from './ClosedMessage'

interface ServicePeriodsProps {
  theme: ThemeColors
  phone: string
  allPeriodTimes: Record<string, PeriodData>
  selectedPeriodId: string | null
  selectedTime: string | null
  onPeriodSelect: (periodId: string) => void
  onTimeSelect: (time: string, customFields: CustomFieldDef[]) => void
}

export default memo(function ServicePeriods({
  theme, phone, allPeriodTimes,
  selectedPeriodId, selectedTime,
  onPeriodSelect, onTimeSelect,
}: ServicePeriodsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Build display list from bookingFlow/times data (only active periods)
  const periodEntries = Object.entries(allPeriodTimes)
  const isLoading = periodEntries.length === 0

  // Auto-expand the last period that has available times when data arrives
  useEffect(() => {
    if (periodEntries.length === 0) {
      setExpandedId(null)
      return
    }
    const withTimes = periodEntries.filter(([, data]) => data.times.length > 0)
    const target = withTimes.length > 0 ? withTimes[withTimes.length - 1] : periodEntries[periodEntries.length - 1]
    setExpandedId(target[0])
    console.log('[RBW] ServicePeriods data loaded:', periodEntries.length, 'periods', periodEntries.map(([id, d]) => `${d.name} (${id}): ${d.times.length} times`))
  }, [allPeriodTimes])

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
    loadingSkeleton: {
      height: 48,
      borderRadius: 8,
      marginBottom: 8,
      background: theme.surface,
      animation: 'rbw-pulse 1.5s ease-in-out infinite',
    },
  }

  // Show loading skeletons while waiting for bookingFlow/times
  if (isLoading) {
    return (
      <div style={s.wrapper}>
        <div style={s.loadingSkeleton} />
        <div style={s.loadingSkeleton} />
      </div>
    )
  }

  return (
    <div style={s.wrapper}>
      {periodEntries.map(([periodId, period]) => {
        const isExpanded = expandedId === periodId
        const isClosed = period.resident_only || !!period.display_message

        return (
          <div key={periodId} style={s.period} role="region" aria-label={period.name}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-controls={`rbw-period-${periodId}`}
              style={{ ...s.header, ...(isExpanded ? s.headerExpanded : {}) }}
              onClick={() => togglePeriod(periodId)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePeriod(periodId) } }}
            >
              <span style={s.periodName}>
                {period.name}
              </span>
              {(period.from || period.to) && (
                <span style={s.periodTime}>
                  {period.from} – {period.to}
                </span>
              )}
              <span style={{ ...s.chevron, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }} aria-hidden="true">
                ▼
              </span>
            </div>
            {isExpanded && (
              <div id={`rbw-period-${periodId}`} style={s.content} role="region">
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
                    times={period.times}
                    selectedTime={selectedPeriodId === periodId ? selectedTime : null}
                    loading={false}
                    onTimeSelect={(time) => handleTimeSelect(periodId, time)}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})

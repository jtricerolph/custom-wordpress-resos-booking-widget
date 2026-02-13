import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import type {
  ResidentInfo, StayDateData, StayNightSelection,
  CustomFieldValue, BatchBookingResult,
} from '../types'
import { styles } from '../utils/theme'
import { useBookingApi } from '../hooks/useBookingApi'
import BookingBatchConfirmation from './BookingBatchConfirmation'

interface StayPlannerProps {
  theme: ThemeColors
  phone: string
  resident: ResidentInfo
  defaultPeople: number
  existingBookedDates?: string[]
  onDone: () => void
}

type NightStatus = 'pending' | 'selected' | 'no_table' | 'already_booked'

interface NightState {
  date: string
  status: NightStatus
  selection?: StayNightSelection
}

export default function StayPlanner({
  theme, phone, resident, defaultPeople, existingBookedDates = [], onDone,
}: StayPlannerProps) {
  const api = useBookingApi()
  const s = styles(theme)

  const [dateData, setDateData] = useState<Record<string, StayDateData>>({})
  const [nights, setNights] = useState<NightState[]>([])
  const [people, setPeople] = useState(defaultPeople)
  const [notes, setNotes] = useState('')
  const [customFieldValues] = useState<CustomFieldValue[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchResults, setBatchResults] = useState<BatchBookingResult[] | null>(null)
  const [noTableDates, setNoTableDates] = useState<string[]>([])

  // Initialize night states
  useEffect(() => {
    const initial: NightState[] = resident.nights.map(date => ({
      date,
      status: existingBookedDates.includes(date) ? 'already_booked' : 'pending',
    }))
    setNights(initial)
  }, [resident.nights, existingBookedDates])

  // Fetch all times on mount
  const loadAllTimes = useCallback(async () => {
    setLoading(true)
    try {
      const planDates = resident.nights.filter(d => !existingBookedDates.includes(d))
      if (planDates.length === 0) {
        setLoading(false)
        return
      }
      const result = await api.fetchAvailableTimesMulti(planDates, people, resident.booking_id)
      setDateData(result)
    } catch {
      setError('Failed to load available times')
    }
    setLoading(false)
  }, [api, resident.nights, resident.booking_id, people, existingBookedDates])

  useEffect(() => {
    loadAllTimes()
  }, [loadAllTimes])

  function selectTime(date: string, periodId: string, periodName: string, time: string) {
    setNights(prev => prev.map(n => {
      if (n.date !== date) return n
      return {
        ...n,
        status: 'selected',
        selection: { date, periodId, periodName, time, people },
      }
    }))
  }

  function toggleNoTable(date: string) {
    setNights(prev => prev.map(n => {
      if (n.date !== date) return n
      if (n.status === 'no_table') {
        return { ...n, status: 'pending', selection: undefined }
      }
      return { ...n, status: 'no_table', selection: undefined }
    }))
  }

  function clearSelection(date: string) {
    setNights(prev => prev.map(n => {
      if (n.date !== date) return n
      return { ...n, status: 'pending', selection: undefined }
    }))
  }

  async function handleSubmit() {
    const selected = nights.filter(n => n.status === 'selected' && n.selection)
    const noTable = nights.filter(n => n.status === 'no_table')

    if (selected.length === 0 && noTable.length === 0) return

    setSubmitting(true)
    setError(null)

    try {
      // Get Turnstile token if configured
      let turnstileToken: string | undefined
      const turnstileResponse = document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')
      if (turnstileResponse?.value) {
        turnstileToken = turnstileResponse.value
      }

      let results: BatchBookingResult[] = []

      // Create bookings
      if (selected.length > 0) {
        const batchResult = await api.createBookingsBatch({
          bookings: selected.map(n => n.selection!),
          name: resident.guest_name,
          email: resident.guest_email,
          phone: resident.guest_phone || undefined,
          notes: notes || undefined,
          custom_fields: customFieldValues.length > 0 ? customFieldValues : undefined,
          resident_booking_id: resident.booking_id,
          turnstile_token: turnstileToken,
        })
        results = batchResult.results
      }

      // Mark no-table dates
      const noTableDateStrings = noTable.map(n => n.date)
      if (noTableDateStrings.length > 0) {
        await api.markNoTable(resident.booking_id, noTableDateStrings).catch(() => {
          // Non-critical — don't block on this
        })
      }

      setBatchResults(results)
      setNoTableDates(noTableDateStrings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      if (window.turnstile) window.turnstile.reset()
    }
    setSubmitting(false)
  }

  // Show results screen
  if (batchResults) {
    return (
      <BookingBatchConfirmation
        theme={theme}
        phone={phone}
        email={resident.guest_email}
        results={batchResults}
        noTableDates={noTableDates}
        onNewBooking={onDone}
      />
    )
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

  const selectedCount = nights.filter(n => n.status === 'selected').length
  const noTableCount = nights.filter(n => n.status === 'no_table').length
  const canSubmit = (selectedCount > 0 || noTableCount > 0) && !submitting

  const nightRow: CSSProperties = {
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  }

  const nightHeader: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: theme.surface,
    fontSize: 14,
    fontWeight: 500,
    color: theme.text,
  }

  const nightBody: CSSProperties = {
    padding: '8px 16px 12px',
    background: theme.background,
    borderTop: `1px solid ${theme.border}`,
  }

  const timeGrid: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  }

  // People selector
  const peopleBtns = []
  const max = window.rbwConfig?.maxPartySize || 12
  for (let i = 1; i < max; i++) peopleBtns.push(i)

  return (
    <div>
      {/* People selector */}
      <div style={{ ...s.section, marginBottom: 16 }}>
        <div style={{ ...s.sectionTitle, marginBottom: 8 }}>Guests per table</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {peopleBtns.map(n => (
            <button
              key={n}
              style={{ ...s.button, ...(n === people ? s.buttonSelected : {}), padding: '6px 12px', fontSize: 13 }}
              onClick={() => setPeople(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Nights */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={s.spinner} />
          <div style={{ marginTop: 8, fontSize: 13, color: theme.textSecondary }}>Loading availability...</div>
        </div>
      ) : (
        <div>
          {nights.map(night => {
            const dd = dateData[night.date]
            const isBooked = night.status === 'already_booked'
            const isNoTable = night.status === 'no_table'
            const isSelected = night.status === 'selected'

            return (
              <div key={night.date} style={nightRow}>
                <div style={{
                  ...nightHeader,
                  ...(isBooked ? { opacity: 0.5 } : {}),
                  ...(isSelected ? { borderLeft: `3px solid ${theme.primary}` } : {}),
                  ...(isNoTable ? { borderLeft: `3px solid ${theme.textSecondary}` } : {}),
                }}>
                  <span>{formatDate(night.date)}</span>
                  {isBooked && <span style={{ fontSize: 12, color: theme.success }}>Already booked</span>}
                  {isSelected && night.selection && (
                    <span style={{ fontSize: 12, color: theme.primary }}>
                      {night.selection.periodName} {formatTime(night.selection.time)}
                      <button
                        type="button"
                        onClick={() => clearSelection(night.date)}
                        style={{
                          background: 'none', border: 'none', color: theme.textSecondary,
                          cursor: 'pointer', marginLeft: 8, fontSize: 12,
                        }}
                      >
                        Change
                      </button>
                    </span>
                  )}
                  {isNoTable && (
                    <span style={{ fontSize: 12, color: theme.textSecondary }}>
                      No table needed
                      <button
                        type="button"
                        onClick={() => toggleNoTable(night.date)}
                        style={{
                          background: 'none', border: 'none', color: theme.textSecondary,
                          cursor: 'pointer', marginLeft: 8, fontSize: 12,
                        }}
                      >
                        Change
                      </button>
                    </span>
                  )}
                </div>

                {!isBooked && !isSelected && !isNoTable && (
                  <div style={nightBody}>
                    {dd?.error ? (
                      <div style={{ ...s.infoMessage, margin: '4px 0' }}>
                        Could not load availability for this date.
                      </div>
                    ) : dd?.periods?.length ? (
                      <div>
                        {dd.periods.map(period => (
                          <div key={period.id} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 600 }}>
                              {period.name} ({period.from} &ndash; {period.to})
                            </div>
                            {period.resident_only && !resident.verified ? (
                              <div style={{ fontSize: 12, color: theme.textSecondary }}>Hotel guests only</div>
                            ) : period.times.length > 0 ? (
                              <div style={timeGrid}>
                                {period.times.map(time => (
                                  <button
                                    key={time}
                                    style={{ ...s.button, fontSize: 12, padding: '4px 10px', minHeight: 32, minWidth: 32 }}
                                    onClick={() => selectTime(night.date, period.id, period.name, time)}
                                    onMouseEnter={(e) => {
                                      Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })
                                    }}
                                    onMouseLeave={(e) => {
                                      Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })
                                    }}
                                  >
                                    {formatTime(time)}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: theme.textSecondary }}>No times available</div>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          style={{
                            background: 'none', border: 'none', fontSize: 12,
                            color: theme.textSecondary, cursor: 'pointer', padding: '4px 0',
                            textDecoration: 'underline',
                          }}
                          onClick={() => toggleNoTable(night.date)}
                        >
                          No table needed this night
                        </button>
                      </div>
                    ) : (
                      <div style={{ ...s.infoMessage, margin: '4px 0' }}>
                        No availability for this date.
                        <button
                          type="button"
                          style={{
                            background: 'none', border: 'none', fontSize: 12,
                            color: theme.textSecondary, cursor: 'pointer', marginLeft: 8,
                            textDecoration: 'underline',
                          }}
                          onClick={() => toggleNoTable(night.date)}
                        >
                          Mark as no table needed
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Notes */}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <label style={s.label}>Special requests or dietary requirements</label>
        <textarea
          value={notes}
          rows={3}
          style={{ ...s.input, resize: 'vertical' as const }}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="These apply to all bookings…"
        />
      </div>

      {/* Turnstile */}
      {window.rbwConfig?.turnstileSiteKey && (
        <div
          className="cf-turnstile"
          data-sitekey={window.rbwConfig.turnstileSiteKey}
          data-theme="light"
          style={{ marginBottom: 16 }}
        />
      )}

      {error && (
        <div style={{ ...s.errorMessage, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        disabled={!canSubmit}
        style={{
          ...s.primaryButton,
          width: '100%',
          opacity: canSubmit ? 1 : 0.6,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
        onClick={handleSubmit}
        onMouseEnter={(e) => {
          if (canSubmit) (e.target as HTMLElement).style.background = theme.primaryHover
        }}
        onMouseLeave={(e) => {
          if (canSubmit) (e.target as HTMLElement).style.background = theme.primary
        }}
      >
        {submitting ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={s.spinner} /> Creating bookings…
          </span>
        ) : (
          <>
            Confirm {selectedCount > 0 ? `${selectedCount} ${selectedCount === 1 ? 'booking' : 'bookings'}` : ''}
            {selectedCount > 0 && noTableCount > 0 ? ' + ' : ''}
            {noTableCount > 0 ? `${noTableCount} no-table` : ''}
          </>
        )}
      </button>
    </div>
  )
}

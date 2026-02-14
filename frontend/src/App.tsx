import { useState, useCallback, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { getTheme, getConfig, styles } from './utils/theme'
import { useBookingFlow } from './hooks/useBookingFlow'
import { useBookingApi } from './hooks/useBookingApi'
import { useUrlParams } from './hooks/useUrlParams'
import type { CustomFieldDef, GuestDetails, CustomFieldValue, DuplicateCheckResult, ResidentInfo, ResidentMatchResult } from './types'
import DatePicker from './components/DatePicker'
import PartySize from './components/PartySize'
import ServicePeriods from './components/ServicePeriods'
import GuestForm from './components/GuestForm'
import BookingConfirmation from './components/BookingConfirmation'
import ResidentBanner from './components/ResidentBanner'
import StayPlanner from './components/StayPlanner'

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function App() {
  const config = getConfig()
  const theme = getTheme(config.colourPreset)
  const s = styles(theme)
  const api = useBookingApi()
  const urlParams = useUrlParams()

  // Flow B: Resident state
  const [residentInfo, setResidentInfo] = useState<ResidentInfo | null>(null)
  const [residentLoading, setResidentLoading] = useState(false)
  const [residentError, setResidentError] = useState<string | null>(null)

  // Flow A: Phase 3 resident match state (from HotelGuestSection)
  const [residentMatch, setResidentMatch] = useState<ResidentMatchResult | null>(null)
  const [groupNotes, setGroupNotes] = useState('')
  const [multiNightDates, setMultiNightDates] = useState<string[]>([])

  const {
    state,
    selectedPeriodName,
    setDate,
    setPeople,
    setAllPeriodTimes,
    setSelectedPeriod,
    setSelectedTime,
    setGuestDetails,
    setCustomFieldValues,
    setDuplicateWarning,
    setBookingConfirmed,
    setLoading,
    setError,
    setSubmitting,
    resetToDate,
    goBackToParty,
    goBackToTime,
  } = useBookingFlow()

  // Flow B: Auto-verify resident when bid+gid in URL
  useEffect(() => {
    if (urlParams.bid) {
      setResidentLoading(true)
      api.verifyResident({
        bid: urlParams.bid,
        gid: urlParams.gid ?? undefined,
      }).then(result => {
        if ('verified' in result && result.verified && 'guest_name' in result) {
          setResidentInfo(result as ResidentInfo)
        } else {
          const errorResult = result as { verified: false; error: string }
          setResidentError(errorResult.error || 'Could not verify your booking link.')
        }
      }).catch(() => {
        setResidentError('Could not verify your booking link. You can continue as a regular guest.')
      }).finally(() => {
        setResidentLoading(false)
      })
    }
  }, [urlParams.bid, urlParams.gid, api])

  const handleDateSelect = useCallback(async (date: string) => {
    console.log('[RBW] Date selected:', date)
    setLoading(true)
    try {
      const periods = await api.fetchOpeningHours(date)
      setDate(date, periods)
    } catch (err) {
      console.error('[RBW] Opening hours fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load opening hours')
    }
  }, [api, setDate, setLoading, setError])

  const handlePeopleSelect = useCallback(async (people: number) => {
    console.log('[RBW] People selected:', people, 'for date:', state.date)
    setPeople(people)

    try {
      const result = await api.fetchAllAvailableTimes(state.date!, people)
      setAllPeriodTimes(result.periods)
    } catch (err) {
      console.error('[RBW] Available times fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load available times')
    }
  }, [api, state.date, setPeople, setAllPeriodTimes, setError])

  const handlePeriodSelect = useCallback((periodId: string) => {
    setSelectedPeriod(periodId)
  }, [setSelectedPeriod])

  const handleTimeSelect = useCallback((time: string, customFields: CustomFieldDef[]) => {
    setSelectedTime(time, customFields)
  }, [setSelectedTime])

  const handleGuestDetailsChange = useCallback((details: Partial<GuestDetails>) => {
    setGuestDetails(details)
  }, [setGuestDetails])

  const handleCustomFieldValuesChange = useCallback((values: CustomFieldValue[]) => {
    setCustomFieldValues(values)
  }, [setCustomFieldValues])

  const handleDuplicateWarningChange = useCallback((warning: DuplicateCheckResult | null) => {
    setDuplicateWarning(warning)
  }, [setDuplicateWarning])

  const handleResidentMatched = useCallback((match: ResidentMatchResult) => {
    setResidentMatch(match)
  }, [])

  const handleGroupNotes = useCallback((notes: string) => {
    setGroupNotes(notes)
  }, [])

  const handleMultiNightSelected = useCallback((nights: string[]) => {
    setMultiNightDates(nights)
  }, [])

  const handleSubmit = useCallback(async (forceDuplicate?: boolean) => {
    if (!state.date || !state.selectedTime || !state.people) return

    setSubmitting()

    try {
      let turnstileToken: string | undefined
      const turnstileResponse = document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')
      if (turnstileResponse?.value) {
        turnstileToken = turnstileResponse.value
      }

      const combinedNotes = [state.guestDetails.notes, groupNotes].filter(Boolean).join(' | ') || undefined

      const result = await api.createBooking({
        date: state.date,
        time: state.selectedTime,
        people: state.people,
        name: state.guestDetails.name,
        email: state.guestDetails.email,
        phone: state.guestDetails.phone || undefined,
        notes: combinedNotes,
        custom_fields: state.customFieldValues.length > 0 ? state.customFieldValues : undefined,
        turnstile_token: turnstileToken,
        force_duplicate: forceDuplicate,
        resident_booking_id: residentMatch?.booking_id,
      })

      if ('duplicate' in result && result.duplicate) {
        setDuplicateWarning(result)
        setError(null)
        if (window.turnstile) window.turnstile.reset()
      } else if ('success' in result && result.success) {
        if (multiNightDates.length > 0 && state.selectedPeriodId) {
          for (const nightDate of multiNightDates) {
            try {
              await api.createBooking({
                date: nightDate,
                time: state.selectedTime,
                people: state.people,
                name: state.guestDetails.name,
                email: state.guestDetails.email,
                phone: state.guestDetails.phone || undefined,
                notes: combinedNotes,
                custom_fields: state.customFieldValues.length > 0 ? state.customFieldValues : undefined,
                force_duplicate: true,
                resident_booking_id: residentMatch?.booking_id,
              })
            } catch {
              // Individual night failure doesn't block the primary booking
            }
          }
        }
        setBookingConfirmed(result.booking_id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      if (window.turnstile) window.turnstile.reset()
    }
  }, [state, api, groupNotes, residentMatch, multiNightDates, setSubmitting, setDuplicateWarning, setBookingConfirmed, setError])

  const turnstileSiteKey = window.rbwConfig?.turnstileSiteKey || ''

  // ---- Summary bar styles ----
  const summaryBar: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    background: theme.surface,
    borderRadius: 8,
    marginBottom: 16,
    border: `1px solid ${theme.border}`,
  }

  const chipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 16,
    border: `1px solid ${theme.border}`,
    background: theme.background,
    fontSize: 13,
    fontWeight: 500,
    color: theme.text,
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  }

  const dotStyle: CSSProperties = {
    color: theme.textSecondary,
    fontSize: 12,
  }

  // ---- Flow B: Resident Stay Planner ----
  if (urlParams.bid) {
    return (
      <div style={s.container}>
        <style>{`@keyframes rbw-spin { to { transform: rotate(360deg) } } @keyframes rbw-pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 0.15 } }`}</style>

        {residentLoading && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={s.spinner} />
            <div style={{ marginTop: 12, color: theme.textSecondary, fontSize: 14 }}>
              Verifying your booking…
            </div>
          </div>
        )}

        {residentError && (
          <div style={{ ...s.infoMessage, marginBottom: 24 }}>
            <div style={{ marginBottom: 12 }}>{residentError}</div>
            <div style={{ fontSize: 13 }}>
              You can still{' '}
              <a
                href={window.location.pathname}
                style={{ color: theme.primary, textDecoration: 'underline' }}
              >
                book as a regular guest
              </a>
              , or call{' '}
              <a href={`tel:${config.phone}`} style={{ color: theme.primary }}>{config.phone}</a>.
            </div>
          </div>
        )}

        {residentInfo && (
          <>
            <ResidentBanner theme={theme} resident={residentInfo} />
            <div style={s.sectionTitle}>Plan Your Stay</div>
            <StayPlanner
              theme={theme}
              phone={config.phone}
              resident={residentInfo}
              defaultPeople={urlParams.people || residentInfo.occupancy || 2}
              onDone={() => {
                window.location.href = window.location.pathname
              }}
            />
          </>
        )}
      </div>
    )
  }

  // ---- Flow A: Regular Booking ----

  if (state.step === 'confirmation' && state.bookingId && state.date && state.selectedTime && state.people) {
    return (
      <div style={s.container}>
        <BookingConfirmation
          theme={theme}
          phone={config.phone}
          periodName={selectedPeriodName}
          date={state.date}
          time={state.selectedTime}
          people={state.people}
          email={state.guestDetails.email}
          bookingId={state.bookingId}
          onNewBooking={resetToDate}
        />
      </div>
    )
  }

  return (
    <div style={s.container}>
      <style>{`@keyframes rbw-spin { to { transform: rotate(360deg) } } @keyframes rbw-pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 0.15 } }`}</style>

      {/* Summary bar — shows completed selections, clickable to go back */}
      {state.step !== 'date' && state.date && (
        <div style={summaryBar}>
          <button
            type="button"
            style={chipStyle}
            onClick={resetToDate}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.primary)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.border)}
          >
            {formatDateShort(state.date)}
          </button>
          {state.people && state.step !== 'party_size' && (
            <>
              <span style={dotStyle}>&middot;</span>
              <button
                type="button"
                style={chipStyle}
                onClick={goBackToParty}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.border)}
              >
                {state.people} {state.people === 1 ? 'guest' : 'guests'}
              </button>
            </>
          )}
          {state.selectedTime && (state.step === 'guest_details' || state.step === 'submitting') && (
            <>
              <span style={dotStyle}>&middot;</span>
              <button
                type="button"
                style={chipStyle}
                onClick={goBackToTime}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.primary)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.border)}
              >
                {selectedPeriodName ? `${selectedPeriodName} · ` : ''}{state.selectedTime}
              </button>
            </>
          )}
        </div>
      )}

      {/* Step: Date */}
      {state.step === 'date' && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Select a Date</div>
          <DatePicker
            theme={theme}
            maxBookingWindow={config.maxBookingWindow}
            selectedDate={state.date}
            onDateSelect={handleDateSelect}
          />
          {state.loading && (
            <div style={{ textAlign: 'center', padding: 8 }}>
              <div style={s.spinner} />
            </div>
          )}
        </div>
      )}

      {/* Step: Party Size */}
      {state.step === 'party_size' && (
        <div style={s.section}>
          <PartySize
            theme={theme}
            maxPartySize={config.maxPartySize}
            phone={config.phone}
            selected={state.people}
            onSelect={handlePeopleSelect}
          />
        </div>
      )}

      {/* Step: Time Selection */}
      {state.step === 'time_selection' && state.date && state.people && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Choose a Time</div>
          {state.error && (
            <div style={{ color: theme.error, fontSize: 13, marginBottom: 8 }} role="alert">
              {state.error}
            </div>
          )}
          <ServicePeriods
            theme={theme}
            phone={config.phone}
            allPeriodTimes={state.allPeriodTimes}
            selectedPeriodId={state.selectedPeriodId}
            selectedTime={state.selectedTime}
            onPeriodSelect={handlePeriodSelect}
            onTimeSelect={handleTimeSelect}
          />
        </div>
      )}

      {/* Step: Guest Details */}
      {(state.step === 'guest_details' || state.step === 'submitting') && state.date && state.selectedTime && state.people && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Your Details</div>
          <GuestForm
            theme={theme}
            phone={config.phone}
            date={state.date}
            people={state.people}
            selectedTime={state.selectedTime}
            selectedPeriodName={selectedPeriodName}
            customFields={state.activeCustomFields}
            guestDetails={state.guestDetails}
            customFieldValues={state.customFieldValues}
            duplicateWarning={state.duplicateWarning}
            loading={state.loading}
            error={state.error}
            turnstileSiteKey={turnstileSiteKey}
            residentMatch={residentMatch}
            onGuestDetailsChange={handleGuestDetailsChange}
            onCustomFieldValuesChange={handleCustomFieldValuesChange}
            onDuplicateWarningChange={handleDuplicateWarningChange}
            onResidentMatched={handleResidentMatched}
            onGroupNotes={handleGroupNotes}
            onMultiNightSelected={handleMultiNightSelected}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </div>
  )
}

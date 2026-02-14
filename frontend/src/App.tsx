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
      console.log('[RBW] Opening hours response:', JSON.stringify(periods, null, 2))
      console.log('[RBW] Periods count:', periods.length, 'IDs:', periods.map((p: { id: string; name: string; resident_only: boolean; display_message: string | null }) => `${p.id} (${p.name}) resident_only=${p.resident_only} msg=${p.display_message}`))
      setDate(date, periods)
    } catch (err) {
      console.error('[RBW] Opening hours fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load opening hours')
    }
  }, [api, setDate, setLoading, setError])

  const handlePeopleSelect = useCallback(async (people: number) => {
    console.log('[RBW] People selected:', people, 'for date:', state.date)
    // Immediately show ServicePeriods with loading skeletons
    setPeople(people)

    // Fetch all period times in background
    try {
      console.log('[RBW] Fetching all available times...')
      const result = await api.fetchAllAvailableTimes(state.date!, people)
      console.log('[RBW] All available times raw response:', JSON.stringify(result, null, 2))
      const periodIds = Object.keys(result.periods || {})
      console.log('[RBW] Periods with times:', periodIds.length, 'IDs:', periodIds)
      periodIds.forEach(id => {
        const p = result.periods[id]
        console.log(`[RBW]   Period ${id}: ${p.times.length} times, ${p.activeCustomFields.length} custom fields`)
      })
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

      // Combine notes: user notes + group notes
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
        // Create additional bookings for selected multi-night dates
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

  // Section visibility
  const showPartySize = state.step !== 'date'
  const showTimePeriods = state.step !== 'date' && state.step !== 'party_size'
  const showGuestForm = state.step === 'guest_details' || state.step === 'submitting'
  const showConfirmation = state.step === 'confirmation'

  const sectionTransition: CSSProperties = {
    overflow: 'hidden',
    transition: 'opacity 0.3s ease, max-height 0.4s ease',
  }

  const turnstileSiteKey = window.rbwConfig?.turnstileSiteKey || ''

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
                // Clear URL params and reload as regular flow
                window.location.href = window.location.pathname
              }}
            />
          </>
        )}
      </div>
    )
  }

  // ---- Flow A: Regular Booking ----

  if (showConfirmation && state.bookingId && state.date && state.selectedTime && state.people) {
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

      {/* Date Picker */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Select a Date</div>
        <DatePicker
          theme={theme}
          maxBookingWindow={config.maxBookingWindow}
          selectedDate={state.date}
          onDateSelect={handleDateSelect}
        />
        {state.loading && state.step === 'date' && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div style={s.spinner} />
          </div>
        )}
      </div>

      {/* Party Size */}
      {showPartySize && (
        <div style={{ ...s.section, ...sectionTransition }}>
          <PartySize
            theme={theme}
            maxPartySize={config.maxPartySize}
            phone={config.phone}
            selected={state.people}
            onSelect={handlePeopleSelect}
          />
        </div>
      )}

      {/* Service Periods + Time Slots */}
      {showTimePeriods && state.date && state.people && (
        <div style={{ ...s.section, ...sectionTransition }}>
          <div style={s.sectionTitle}>Choose a Time</div>
          {state.error && state.step === 'time_selection' && (
            <div style={{ color: theme.error, fontSize: 13, marginBottom: 8 }} role="alert">
              {state.error}
            </div>
          )}
          <ServicePeriods
            theme={theme}
            phone={config.phone}
            periods={state.periods}
            allPeriodTimes={state.allPeriodTimes}
            date={state.date}
            people={state.people}
            selectedPeriodId={state.selectedPeriodId}
            selectedTime={state.selectedTime}
            onPeriodSelect={handlePeriodSelect}
            onTimeSelect={handleTimeSelect}
          />
        </div>
      )}

      {/* Guest Form */}
      {showGuestForm && state.date && state.selectedTime && state.people && (
        <div style={{ ...s.section, ...sectionTransition }}>
          <div style={s.sectionTitle}>Your Details</div>
          <GuestForm
            theme={theme}
            phone={config.phone}
            date={state.date!}
            people={state.people!}
            selectedTime={state.selectedTime!}
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

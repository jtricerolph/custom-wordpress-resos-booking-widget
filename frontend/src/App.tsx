import { useCallback } from 'react'
import type { CSSProperties } from 'react'
import { getTheme, getConfig, styles } from './utils/theme'
import { useBookingFlow } from './hooks/useBookingFlow'
import { useBookingApi } from './hooks/useBookingApi'
import type { CustomFieldDef, GuestDetails, CustomFieldValue, DuplicateCheckResult } from './types'
import DatePicker from './components/DatePicker'
import PartySize from './components/PartySize'
import ServicePeriods from './components/ServicePeriods'
import GuestForm from './components/GuestForm'
import BookingConfirmation from './components/BookingConfirmation'

export default function App() {
  const config = getConfig()
  const theme = getTheme(config.colourPreset)
  const s = styles(theme)
  const api = useBookingApi()

  const {
    state,
    selectedPeriodName,
    setDate,
    setPeople,
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

  const handleDateSelect = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const periods = await api.fetchOpeningHours(date)
      setDate(date, periods)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load opening hours')
    }
  }, [api, setDate, setLoading, setError])

  const handlePeopleSelect = useCallback((people: number) => {
    setPeople(people)
  }, [setPeople])

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

  const handleSubmit = useCallback(async (forceDuplicate?: boolean) => {
    if (!state.date || !state.selectedTime || !state.people) return

    setSubmitting()

    try {
      // Get Turnstile token if configured
      let turnstileToken: string | undefined
      const turnstileResponse = document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')
      if (turnstileResponse?.value) {
        turnstileToken = turnstileResponse.value
      }

      const result = await api.createBooking({
        date: state.date,
        time: state.selectedTime,
        people: state.people,
        name: state.guestDetails.name,
        email: state.guestDetails.email,
        phone: state.guestDetails.phone || undefined,
        notes: state.guestDetails.notes || undefined,
        custom_fields: state.customFieldValues.length > 0 ? state.customFieldValues : undefined,
        turnstile_token: turnstileToken,
        force_duplicate: forceDuplicate,
      })

      if ('duplicate' in result && result.duplicate) {
        setDuplicateWarning(result)
        setError(null)
        // Reset Turnstile for retry
        if (window.turnstile) {
          window.turnstile.reset()
        }
      } else if ('success' in result && result.success) {
        setBookingConfirmed(result.booking_id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      // Reset Turnstile on error
      if (window.turnstile) {
        window.turnstile.reset()
      }
    }
  }, [state, api, setSubmitting, setDuplicateWarning, setBookingConfirmed, setError])

  // Section visibility based on step progression
  const showPartySize = state.step !== 'date'
  const showTimePeriods = state.step !== 'date' && state.step !== 'party_size'
  const showGuestForm = state.step === 'guest_details' || state.step === 'submitting'
  const showConfirmation = state.step === 'confirmation'

  const sectionTransition: CSSProperties = {
    overflow: 'hidden',
    transition: 'opacity 0.3s ease, max-height 0.4s ease',
  }

  const turnstileSiteKey = window.rbwConfig?.turnstileSiteKey || ''

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
      {/* Spinner keyframes */}
      <style>{`@keyframes rbw-spin { to { transform: rotate(360deg) } }`}</style>

      {/* Date Picker — always visible */}
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
          <ServicePeriods
            theme={theme}
            phone={config.phone}
            periods={state.periods}
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
            customFields={state.activeCustomFields}
            guestDetails={state.guestDetails}
            customFieldValues={state.customFieldValues}
            duplicateWarning={state.duplicateWarning}
            loading={state.loading}
            error={state.error}
            turnstileSiteKey={turnstileSiteKey}
            onGuestDetailsChange={handleGuestDetailsChange}
            onCustomFieldValuesChange={handleCustomFieldValuesChange}
            onDuplicateWarningChange={handleDuplicateWarningChange}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </div>
  )
}

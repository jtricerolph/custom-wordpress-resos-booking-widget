import { useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import type {
  CustomFieldDef,
  CustomFieldValue,
  GuestDetails,
  DuplicateCheckResult,
  ResidentMatchResult,
} from '../types'
import { styles } from '../utils/theme'
import { validateEmail, validatePhone, validateName } from '../utils/validation'
import CustomFields from './CustomFields'
import DuplicateWarning from './DuplicateWarning'
import HotelGuestSection from './HotelGuestSection'
import GroupBookingPrompt from './GroupBookingPrompt'
import MultiNightUpsell from './MultiNightUpsell'

interface GuestFormProps {
  theme: ThemeColors
  phone: string
  date: string
  people: number
  selectedTime: string
  selectedPeriodName: string
  customFields: CustomFieldDef[]
  guestDetails: GuestDetails
  customFieldValues: CustomFieldValue[]
  duplicateWarning: DuplicateCheckResult | null
  loading: boolean
  error: string | null
  turnstileSiteKey: string
  residentMatch: ResidentMatchResult | null
  onGuestDetailsChange: (details: Partial<GuestDetails>) => void
  onCustomFieldValuesChange: (values: CustomFieldValue[]) => void
  onDuplicateWarningChange: (warning: DuplicateCheckResult | null) => void
  onResidentMatched: (match: ResidentMatchResult) => void
  onGroupNotes: (notes: string) => void
  onMultiNightSelected: (nights: string[]) => void
  onSubmit: (forceDuplicate?: boolean) => void
}

export default function GuestForm({
  theme, phone, date, people, selectedTime, selectedPeriodName,
  customFields, guestDetails, customFieldValues,
  duplicateWarning, loading, error, turnstileSiteKey,
  residentMatch,
  onGuestDetailsChange, onCustomFieldValuesChange,
  onDuplicateWarningChange, onResidentMatched, onGroupNotes, onMultiNightSelected,
  onSubmit,
}: GuestFormProps) {
  const s = styles(theme)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const markTouched = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }, [])

  const nameError = touched.name && !validateName(guestDetails.name) ? 'Name is required (min 2 characters)' : null
  const emailError = touched.email && !validateEmail(guestDetails.email) ? 'Valid email is required' : null
  const phoneError = touched.phone && !validatePhone(guestDetails.phone) ? 'Invalid phone number' : null

  // Check required custom fields
  const requiredFieldErrors = customFields
    .filter(f => f.isRequired)
    .filter(f => {
      const val = customFieldValues.find(v => v._id === f._id)
      if (!val) return true
      if (typeof val.value === 'string') return val.value.trim() === ''
      if (Array.isArray(val.value)) return val.value.length === 0
      return true
    })

  const canSubmit =
    validateName(guestDetails.name) &&
    validateEmail(guestDetails.email) &&
    validatePhone(guestDetails.phone) &&
    requiredFieldErrors.length === 0 &&
    !loading

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Touch all core fields
    setTouched({ name: true, email: true, phone: true })
    if (canSubmit) {
      onSubmit()
    }
  }

  function handleDuplicateCancel() {
    onDuplicateWarningChange(null)
  }

  function handleDuplicateProceed() {
    onDuplicateWarningChange(null)
    onSubmit(true)
  }

  const fieldGroupStyle: CSSProperties = {
    marginBottom: 16,
  }

  const rowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Guest booking details">
      <div style={fieldGroupStyle}>
        <label htmlFor="rbw-name" style={s.label}>
          Name <span style={{ color: theme.error }} aria-hidden="true">*</span>
        </label>
        <input
          id="rbw-name"
          type="text"
          value={guestDetails.name}
          autoComplete="name"
          aria-required="true"
          aria-invalid={!!nameError}
          style={{ ...s.input, ...(focusedField === 'name' ? s.inputFocus : {}), ...(nameError ? { borderColor: theme.error } : {}) }}
          onFocus={() => setFocusedField('name')}
          onBlur={() => { setFocusedField(null); markTouched('name') }}
          onChange={(e) => onGuestDetailsChange({ name: e.target.value })}
        />
        {nameError && <div style={s.errorText} role="alert">{nameError}</div>}
      </div>

      <div style={rowStyle}>
        <div style={{ ...fieldGroupStyle, flex: 1, minWidth: 180 }}>
          <label htmlFor="rbw-email" style={s.label}>
            Email <span style={{ color: theme.error }} aria-hidden="true">*</span>
          </label>
          <input
            id="rbw-email"
            type="email"
            value={guestDetails.email}
            autoComplete="email"
            aria-required="true"
            aria-invalid={!!emailError}
            style={{ ...s.input, ...(focusedField === 'email' ? s.inputFocus : {}), ...(emailError ? { borderColor: theme.error } : {}) }}
            onFocus={() => setFocusedField('email')}
            onBlur={() => { setFocusedField(null); markTouched('email') }}
            onChange={(e) => onGuestDetailsChange({ email: e.target.value })}
          />
          {emailError && <div style={s.errorText} role="alert">{emailError}</div>}
        </div>

        <div style={{ ...fieldGroupStyle, flex: 1, minWidth: 180 }}>
          <label htmlFor="rbw-phone" style={s.label}>Phone</label>
          <input
            id="rbw-phone"
            type="tel"
            value={guestDetails.phone}
            autoComplete="tel"
            aria-invalid={!!phoneError}
            style={{ ...s.input, ...(focusedField === 'phone' ? s.inputFocus : {}), ...(phoneError ? { borderColor: theme.error } : {}) }}
            onFocus={() => setFocusedField('phone')}
            onBlur={() => { setFocusedField(null); markTouched('phone') }}
            onChange={(e) => onGuestDetailsChange({ phone: e.target.value })}
          />
          {phoneError && <div style={s.errorText} role="alert">{phoneError}</div>}
        </div>
      </div>

      {/* Hotel Guest Section — appears after name/email/phone */}
      {guestDetails.name.length >= 2 && guestDetails.email.includes('@') && (
        <HotelGuestSection
          theme={theme}
          phone={phone}
          date={date}
          guestName={guestDetails.name}
          guestEmail={guestDetails.email}
          guestPhone={guestDetails.phone}
          onResidentMatched={onResidentMatched}
        />
      )}

      {/* Group Booking Prompt — when matched resident is in a group */}
      {residentMatch && residentMatch.booking_id && residentMatch.group_id && (
        <GroupBookingPrompt
          theme={theme}
          phone={phone}
          date={date}
          bookingId={residentMatch.booking_id}
          groupId={residentMatch.group_id}
          covers={people}
          occupancy={residentMatch.occupancy || people}
          onNotesUpdate={onGroupNotes}
        />
      )}

      {/* Multi Night Upsell — when matched resident has multi-night stay */}
      {residentMatch && residentMatch.nights && residentMatch.nights.length > 1 && (
        <MultiNightUpsell
          theme={theme}
          match={residentMatch}
          selectedDate={date}
          selectedTime={selectedTime}
          selectedPeriodName={selectedPeriodName}
          people={people}
          onNightsSelected={onMultiNightSelected}
        />
      )}

      <CustomFields
        theme={theme}
        fields={customFields}
        values={customFieldValues}
        onChange={onCustomFieldValuesChange}
      />

      <div style={fieldGroupStyle}>
        <label htmlFor="rbw-notes" style={s.label}>Notes</label>
        <textarea
          id="rbw-notes"
          value={guestDetails.notes}
          rows={3}
          style={{
            ...s.input,
            ...(focusedField === 'notes' ? s.inputFocus : {}),
            resize: 'vertical' as const,
          }}
          onFocus={() => setFocusedField('notes')}
          onBlur={() => setFocusedField(null)}
          onChange={(e) => onGuestDetailsChange({ notes: e.target.value })}
          placeholder="Any special requests or dietary requirements…"
        />
      </div>

      {duplicateWarning && (
        <DuplicateWarning
          theme={theme}
          duplicate={duplicateWarning}
          onCancel={handleDuplicateCancel}
          onProceed={handleDuplicateProceed}
        />
      )}

      {error && (
        <div style={{ ...s.errorMessage, marginBottom: 16 }}>
          {error}
          {phone && (
            <span>
              {' '}Please try again or call{' '}
              <a href={`tel:${phone}`} style={{ color: theme.error, fontWeight: 600 }}>{phone}</a>.
            </span>
          )}
        </div>
      )}

      {turnstileSiteKey && (
        <div
          className="cf-turnstile"
          data-sitekey={turnstileSiteKey}
          data-theme="light"
          style={{ marginBottom: 16 }}
        />
      )}

      {!duplicateWarning && (
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...s.primaryButton,
            width: '100%',
            opacity: canSubmit ? 1 : 0.6,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={(e) => {
            if (canSubmit) (e.target as HTMLElement).style.background = theme.primaryHover
          }}
          onMouseLeave={(e) => {
            if (canSubmit) (e.target as HTMLElement).style.background = theme.primary
          }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={s.spinner} /> Booking…
            </span>
          ) : (
            `Confirm Booking`
          )}
        </button>
      )}
    </form>
  )
}

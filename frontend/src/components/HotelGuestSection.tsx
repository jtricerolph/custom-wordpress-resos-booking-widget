import { useState, useCallback, useEffect, useRef } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { ResidentMatchResult } from '../types'
import { styles } from '../utils/theme'
import { useBookingApi } from '../hooks/useBookingApi'
import { validateEmail } from '../utils/validation'

interface HotelGuestSectionProps {
  theme: ThemeColors
  phone: string
  date: string
  guestName: string
  guestEmail: string
  guestPhone: string
  onResidentMatched: (match: ResidentMatchResult) => void
}

type SectionState =
  | 'waiting'          // Haven't checked yet or inputs changed
  | 'checking'         // Auto-check in progress
  | 'auto_matched'     // Tier 1: email + surname match
  | 'phone_prompt'     // Tier 2: surname only, needs phone verify
  | 'phone_verifying'
  | 'phone_verified'
  | 'no_match'         // Tier 3: no match found, show subtle link
  | 'manual_entry'     // User opened manual reference entry
  | 'ref_verifying'
  | 'ref_verified'
  | 'ota_detected'
  | 'unverified'

export default function HotelGuestSection({
  theme, phone, date, guestName, guestEmail, guestPhone,
  onResidentMatched,
}: HotelGuestSectionProps) {
  const api = useBookingApi()
  const s = styles(theme)

  const [sectionState, setSectionState] = useState<SectionState>('waiting')
  const [match, setMatch] = useState<ResidentMatchResult | null>(null)
  const [phoneInput, setPhoneInput] = useState(guestPhone || '')
  const [refInput, setRefInput] = useState('')
  const [otaAgentName, setOtaAgentName] = useState('')
  const [otaInternalId, setOtaInternalId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refs to avoid stale closures in debounced effect
  const apiRef = useRef(api)
  apiRef.current = api
  const callbackRef = useRef(onResidentMatched)
  callbackRef.current = onResidentMatched
  const stateRef = useRef(sectionState)
  stateRef.current = sectionState

  // Track last checked key to avoid redundant calls
  const lastChecked = useRef('')

  // Interactive states where we shouldn't auto-recheck
  const interactiveStates = ['phone_prompt', 'phone_verifying', 'phone_verified', 'manual_entry', 'ref_verifying', 'ref_verified', 'ota_detected', 'unverified']

  // Auto-check when name/email change (debounced 800ms)
  useEffect(() => {
    const name = guestName.trim()
    const email = guestEmail.trim().toLowerCase()
    const checkKey = `${name}|${email}|${date}`

    // Don't auto-check if inputs are incomplete
    if (name.length < 2 || !validateEmail(guestEmail)) return

    // Don't re-check same inputs
    if (checkKey === lastChecked.current) return

    // If in interactive state (user is doing phone/ref verification), don't interrupt
    if (interactiveStates.includes(stateRef.current)) return

    const timer = setTimeout(async () => {
      // Re-check interactive state at execution time
      if (interactiveStates.includes(stateRef.current)) return

      lastChecked.current = checkKey
      setSectionState('checking')

      try {
        const result = await apiRef.current.checkResident(date, guestName, guestEmail, guestPhone || undefined)

        if (result.match_tier === 1) {
          setMatch(result)
          setSectionState('auto_matched')
          callbackRef.current(result)
        } else if (result.match_tier === 2) {
          setMatch(result)
          setSectionState(result.phone_on_file ? 'phone_prompt' : 'manual_entry')
        } else {
          setSectionState('no_match')
        }
      } catch {
        setSectionState('no_match')
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [guestName, guestEmail, guestPhone, date])

  // Sync phoneInput when guestPhone prop changes
  useEffect(() => {
    if (guestPhone && !phoneInput) {
      setPhoneInput(guestPhone)
    }
  }, [guestPhone])

  const handlePhoneVerify = useCallback(async () => {
    if (!phoneInput.trim()) return
    setSectionState('phone_verifying')
    setError(null)

    try {
      const result = await api.verifyResidentPhone(date, guestName, phoneInput)
      if (result.verified && result.booking_id) {
        const fullMatch: ResidentMatchResult = {
          match_tier: 1,
          booking_id: result.booking_id,
          check_in: result.check_in,
          check_out: result.check_out,
          nights: result.nights,
          room: result.room,
          occupancy: result.occupancy,
          group_id: result.group_id,
        }
        setMatch(fullMatch)
        setSectionState('phone_verified')
        onResidentMatched(fullMatch)
      } else {
        setError('Phone number did not match. You can enter your booking reference below.')
        setSectionState('manual_entry')
      }
    } catch {
      setError('Could not verify phone. You can enter your booking reference instead.')
      setSectionState('manual_entry')
    }
  }, [api, date, guestName, phoneInput, onResidentMatched])

  const handleRefVerify = useCallback(async () => {
    if (!refInput.trim()) return
    setSectionState('ref_verifying')
    setError(null)

    try {
      const result = await api.verifyResidentReference(date, refInput)
      if (result.verified && result.booking_id) {
        if (result.ota_match && result.internal_booking_id) {
          setOtaAgentName(result.travel_agent_name || 'your booking agent')
          setOtaInternalId(result.internal_booking_id)
          setRefInput(String(result.internal_booking_id))
          setSectionState('ota_detected')
          onResidentMatched({
            match_tier: 1,
            booking_id: result.internal_booking_id,
          })
        } else {
          setSectionState('ref_verified')
          onResidentMatched({
            match_tier: 1,
            booking_id: result.booking_id,
          })
        }
      } else {
        setSectionState('unverified')
      }
    } catch {
      setSectionState('unverified')
    }
  }, [api, date, refInput, onResidentMatched])

  const handleContinueUnverified = useCallback(() => {
    onResidentMatched({
      match_tier: 3,
      booking_reference_id: refInput,
    })
    setSectionState('unverified')
  }, [refInput, onResidentMatched])

  const sectionStyle = {
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    background: theme.background,
  }

  // Waiting or checking: render nothing (check happens silently)
  if (sectionState === 'waiting' || sectionState === 'checking') {
    return null
  }

  // No match: show subtle link to enter reference manually
  if (sectionState === 'no_match') {
    return (
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setSectionState('manual_entry')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 13,
            color: theme.textSecondary,
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          Staying at the hotel? Enter your booking reference
        </button>
      </div>
    )
  }

  return (
    <div style={sectionStyle}>
      {/* Tier 1: Auto-matched */}
      {(sectionState === 'auto_matched' || sectionState === 'phone_verified' || sectionState === 'ref_verified') && match && (
        <div>
          <div style={{ color: theme.success, fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            It looks like you're staying at the hotel!
          </div>
          {match.booking_id && (
            <div style={{ fontSize: 13, color: theme.textSecondary }}>
              Booking #{match.booking_id}
              {match.room && <> &middot; Room {match.room}</>}
            </div>
          )}
        </div>
      )}

      {/* Tier 2: Phone prompt */}
      {sectionState === 'phone_prompt' && (
        <div>
          <div style={{ fontSize: 14, color: theme.text, marginBottom: 12 }}>
            We found a booking under your name. Verify with your mobile to confirm.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Mobile</label>
              <input
                type="tel"
                value={phoneInput}
                style={s.input}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="07700 900123"
              />
            </div>
            <button
              type="button"
              style={{ ...s.primaryButton, fontSize: 13, padding: '10px 16px' }}
              onClick={handlePhoneVerify}
              disabled={!phoneInput.trim()}
            >
              Verify
            </button>
          </div>
          <button
            type="button"
            style={{ background: 'none', border: 'none', fontSize: 12, color: theme.textSecondary, cursor: 'pointer', marginTop: 8, textDecoration: 'underline', padding: 0 }}
            onClick={() => setSectionState('manual_entry')}
          >
            I know my booking reference
          </button>
        </div>
      )}

      {sectionState === 'phone_verifying' && (
        <div style={{ textAlign: 'center', padding: 8 }}>
          <div style={s.spinner} />
          <div style={{ marginTop: 4, fontSize: 13, color: theme.textSecondary }}>Verifying…</div>
        </div>
      )}

      {/* Manual reference entry */}
      {(sectionState === 'manual_entry' || sectionState === 'ref_verifying') && (
        <div>
          <div style={{ fontSize: 14, color: theme.text, marginBottom: 12 }}>
            Enter your booking reference number:
          </div>
          {error && <div style={{ ...s.errorText, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>Booking Reference</label>
              <input
                type="text"
                value={refInput}
                style={s.input}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="e.g. 12345"
              />
            </div>
            <button
              type="button"
              style={{ ...s.primaryButton, fontSize: 13, padding: '10px 16px' }}
              onClick={handleRefVerify}
              disabled={!refInput.trim() || sectionState === 'ref_verifying'}
            >
              {sectionState === 'ref_verifying' ? '…' : 'Verify'}
            </button>
          </div>
          <button
            type="button"
            style={{ background: 'none', border: 'none', fontSize: 12, color: theme.textSecondary, cursor: 'pointer', marginTop: 8, padding: 0 }}
            onClick={() => setSectionState('no_match')}
          >
            Not staying at hotel
          </button>
        </div>
      )}

      {/* OTA detected */}
      {sectionState === 'ota_detected' && (
        <div>
          <div style={{ color: theme.success, fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            We found your booking from {otaAgentName}!
          </div>
          <div style={{ fontSize: 13, color: theme.textSecondary }}>
            Our reference for your booking is #{otaInternalId}. We've updated it for you.
          </div>
        </div>
      )}

      {/* Unverified */}
      {sectionState === 'unverified' && (
        <div>
          <div style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 12 }}>
            We couldn't verify your stay. Please check your booking confirmation email for your reference number, or ask reception.
          </div>
          <button
            type="button"
            style={{ ...s.button, fontSize: 13 }}
            onClick={handleContinueUnverified}
            onMouseEnter={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })}
            onMouseLeave={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })}
          >
            Continue booking
          </button>
          <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>
            Or call <a href={`tel:${phone}`} style={{ color: theme.primary }}>{phone}</a> for help.
          </div>
        </div>
      )}
    </div>
  )
}

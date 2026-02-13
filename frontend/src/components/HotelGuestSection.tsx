import { useState, useCallback } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { ResidentMatchResult } from '../types'
import { styles } from '../utils/theme'
import { useBookingApi } from '../hooks/useBookingApi'

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
  | 'initial'
  | 'checking'
  | 'auto_matched'     // Tier 1
  | 'phone_prompt'     // Tier 2
  | 'phone_verifying'
  | 'phone_verified'
  | 'manual_entry'     // Tier 3
  | 'ref_verifying'
  | 'ref_verified'
  | 'ota_detected'
  | 'unverified'
  | 'declined'         // Guest said "No"

export default function HotelGuestSection({
  theme, phone, date, guestName, guestEmail, guestPhone,
  onResidentMatched,
}: HotelGuestSectionProps) {
  const api = useBookingApi()
  const s = styles(theme)

  const [sectionState, setSectionState] = useState<SectionState>('initial')
  const [match, setMatch] = useState<ResidentMatchResult | null>(null)
  const [phoneInput, setPhoneInput] = useState(guestPhone || '')
  const [refInput, setRefInput] = useState('')
  const [otaAgentName, setOtaAgentName] = useState('')
  const [otaInternalId, setOtaInternalId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleYes = useCallback(async () => {
    setSectionState('checking')
    setError(null)

    try {
      const result = await api.checkResident(date, guestName, guestEmail, guestPhone || undefined)

      if (result.match_tier === 1) {
        setMatch(result)
        setSectionState('auto_matched')
        onResidentMatched(result)
      } else if (result.match_tier === 2) {
        setMatch(result)
        if (result.phone_on_file) {
          setSectionState('phone_prompt')
        } else {
          // No phone on file, go to manual entry
          setSectionState('manual_entry')
        }
      } else if (result.match_tier === 3) {
        setSectionState('manual_entry')
      } else {
        // match_tier 0: staying list unavailable
        setSectionState('manual_entry')
      }
    } catch {
      setSectionState('manual_entry')
    }
  }, [api, date, guestName, guestEmail, guestPhone, onResidentMatched])

  const handleNo = useCallback(() => {
    setSectionState('declined')
  }, [])

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
    // Pass the manually entered reference even though unverified
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

  // Declined — don't show anything
  if (sectionState === 'declined') return null

  return (
    <div style={sectionStyle}>
      {/* Initial: Yes / No question */}
      {sectionState === 'initial' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: theme.text, marginBottom: 12 }}>
            Are you staying at the hotel?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={s.button} onClick={handleYes}
              onMouseEnter={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })}
              onMouseLeave={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })}
            >Yes</button>
            <button type="button" style={s.button} onClick={handleNo}
              onMouseEnter={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })}
              onMouseLeave={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })}
            >No</button>
          </div>
        </div>
      )}

      {/* Checking spinner */}
      {sectionState === 'checking' && (
        <div style={{ textAlign: 'center', padding: 8 }}>
          <div style={s.spinner} />
        </div>
      )}

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
            Not sure about your booking number? Add your mobile and we can try to verify and find it for you.
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

      {/* Tier 3: Manual reference entry */}
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

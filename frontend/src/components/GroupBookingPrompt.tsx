import { useState, useEffect } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { GroupCheckResult } from '../types'
import { styles } from '../utils/theme'
import { useBookingApi } from '../hooks/useBookingApi'

interface GroupBookingPromptProps {
  theme: ThemeColors
  phone: string
  date: string
  bookingId: number
  groupId: number
  covers: number
  occupancy: number
  onNotesUpdate: (note: string) => void
}

export default function GroupBookingPrompt({
  theme, phone, date, bookingId, groupId, covers, occupancy,
  onNotesUpdate,
}: GroupBookingPromptProps) {
  const api = useBookingApi()
  const s = styles(theme)

  const [groupData, setGroupData] = useState<GroupCheckResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [choice, setChoice] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.checkGroup(date, bookingId, groupId, covers).then(result => {
      setGroupData(result)
    }).catch(() => {
      setGroupData(null)
    }).finally(() => {
      setLoading(false)
    })
  }, [api, date, bookingId, groupId, covers])

  if (loading) return <div style={{ textAlign: 'center', padding: 8 }}><div style={s.spinner} /></div>
  if (!groupData || !groupData.is_group) return null

  const existingTables = groupData.existing_tables || []
  const hasExistingTables = existingTables.length > 0

  const sectionStyle = {
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    background: theme.background,
  }

  // Scenario: Other group members already have tables
  if (hasExistingTables) {
    const someoneBookedForGroup = existingTables.some(t => t.covers > (groupData.guest_occupancy || 0))

    if (someoneBookedForGroup) {
      return (
        <div style={sectionStyle}>
          <div style={{ fontSize: 14, color: theme.text, marginBottom: 12, lineHeight: 1.6 }}>
            There looks like there might be a booking for your group already &mdash; perhaps someone else has already booked.
            We can't show details of that booking. You're welcome to continue booking, but feel free to check with the
            other group members or give us a call if you need assistance on{' '}
            <a href={`tel:${phone}`} style={{ color: theme.primary }}>{phone}</a>.
          </div>
          {choice === null && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={s.button} onClick={() => {
                setChoice('continue')
                onNotesUpdate('Part of group - other members may already have tables booked')
              }}
                onMouseEnter={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })}
                onMouseLeave={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })}
              >Continue booking anyway</button>
            </div>
          )}
          {choice === 'continue' && (
            <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>Noted. Your booking will proceed.</div>
          )}
        </div>
      )
    }

    // Individual bookings by group members
    return (
      <div style={sectionStyle}>
        <div style={{ fontSize: 14, color: theme.text, marginBottom: 12, lineHeight: 1.6 }}>
          It looks like other members of your group already have bookings. If you're dining separately, feel free to continue.
          If you'd like us to sort a table for the whole group, it would be easiest to give us a call on{' '}
          <a href={`tel:${phone}`} style={{ color: theme.primary }}>{phone}</a>.
        </div>
        {choice === null && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={s.button} onClick={() => {
              setChoice('continue')
              onNotesUpdate('Guest says other group members booking separately')
            }}
              onMouseEnter={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })}
              onMouseLeave={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })}
            >Continue booking</button>
          </div>
        )}
      </div>
    )
  }

  // Scenario: No existing group tables
  if (covers > occupancy) {
    // Covers exceed guest's room occupancy
    return (
      <div style={sectionStyle}>
        <div style={{ fontSize: 14, color: theme.text, marginBottom: 12 }}>
          You're part of a group. Looks like you're booking for the group &mdash; should we note this booking is for your group?
        </div>
        {choice === null && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={{ ...s.button, ...(choice === 'group' ? s.buttonSelected : {}) }} onClick={() => {
              setChoice('group')
              onNotesUpdate('Guest confirmed booking is for their group')
            }}
              onMouseEnter={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })}
              onMouseLeave={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })}
            >Yes, this is for our group</button>
            <button type="button" style={s.button} onClick={() => {
              setChoice('individual')
            }}
              onMouseEnter={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })}
              onMouseLeave={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })}
            >No, just for us</button>
          </div>
        )}
        {choice === 'group' && (
          <div style={{ fontSize: 12, color: theme.success, marginTop: 8 }}>Noted as a group booking.</div>
        )}
      </div>
    )
  }

  // Covers equal occupancy but part of group
  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 14, color: theme.text, marginBottom: 12 }}>
        You're part of a group but have only booked for {covers}. Are the other guests booking separately, or would you like to dine together?
      </div>
      {choice === null && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={s.button} onClick={() => {
            setChoice('separate')
            onNotesUpdate('Guest says other group members booking separately')
          }}
            onMouseEnter={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })}
            onMouseLeave={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })}
          >They'll book separately</button>
          <button type="button" style={s.button} onClick={() => {
            setChoice('together')
          }}
            onMouseEnter={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })}
            onMouseLeave={(e) => Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })}
          >We'd like to dine together</button>
        </div>
      )}
      {choice === 'together' && (
        <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 8 }}>
          For group dining, it would be easiest to give us a call on{' '}
          <a href={`tel:${phone}`} style={{ color: theme.primary }}>{phone}</a> so we can arrange the right table.
        </div>
      )}
    </div>
  )
}

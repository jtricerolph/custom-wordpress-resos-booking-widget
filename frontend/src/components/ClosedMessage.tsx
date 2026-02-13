import type { ThemeColors } from '../utils/theme'
import { styles } from '../utils/theme'

interface ClosedMessageProps {
  theme: ThemeColors
  message: string | null
  phone: string
  residentOnly?: boolean
}

/** Turn phone-number-shaped tokens in a string into clickable tel: links */
function linkifyPhones(text: string, theme: ThemeColors): (string | JSX.Element)[] {
  const phoneRegex = /(\+?\d[\d\s\-()]{7,}\d)/g
  const parts: (string | JSX.Element)[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = phoneRegex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const num = match[1]
    const digits = num.replace(/\D/g, '')
    parts.push(
      <a key={match.index} href={`tel:${digits}`} style={{ color: theme.primary, textDecoration: 'none', fontWeight: 600 }}>
        {num}
      </a>
    )
    last = match.index + num.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function ClosedMessage({ theme, message, phone, residentOnly }: ClosedMessageProps) {
  const s = styles(theme)

  const displayMessage = message
    || (residentOnly
      ? `This service is reserved for hotel guests. If you're staying with us, use the link in your booking confirmation email to book, or call ${phone}.`
      : `Fully booked. Please call us on ${phone} to enquire.`)

  return (
    <div style={{ ...s.infoMessage, margin: '8px 0' }} role="status">
      {linkifyPhones(displayMessage, theme)}
    </div>
  )
}

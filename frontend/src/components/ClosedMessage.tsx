import { styles } from '../utils/theme'
import type { ThemeColors } from '../utils/theme'

interface ClosedMessageProps {
  theme: ThemeColors
  message: string | null
  phone: string
}

export default function ClosedMessage({ theme, message, phone }: ClosedMessageProps) {
  const s = styles(theme)
  const displayMessage = message || `Fully booked. Please call us on ${phone} to enquire.`

  return (
    <div style={{ ...s.infoMessage, margin: '8px 0' }}>
      {displayMessage}
    </div>
  )
}

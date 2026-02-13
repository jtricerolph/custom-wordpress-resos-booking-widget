import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import { styles } from '../utils/theme'

interface PartySizeProps {
  theme: ThemeColors
  maxPartySize: number
  phone: string
  selected: number | null
  onSelect: (size: number) => void
}

export default function PartySize({ theme, maxPartySize, phone, selected, onSelect }: PartySizeProps) {
  const [showMaxMessage, setShowMaxMessage] = useState(false)
  const s = styles(theme)

  const buttons: number[] = []
  for (let i = 1; i <= maxPartySize; i++) {
    buttons.push(i)
  }

  function handleClick(size: number) {
    if (size === maxPartySize) {
      setShowMaxMessage(true)
    } else {
      setShowMaxMessage(false)
      onSelect(size)
    }
  }

  const gridStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  }

  return (
    <div>
      <div style={s.sectionTitle}>How many guests?</div>
      <div style={gridStyle}>
        {buttons.map(size => {
          const isMax = size === maxPartySize
          const isSelected = size === selected
          const label = isMax ? `${size}+` : String(size)

          return (
            <button
              key={size}
              style={{
                ...s.button,
                ...(isSelected ? s.buttonSelected : {}),
              }}
              onClick={() => handleClick(size)}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  Object.assign((e.target as HTMLElement).style, { borderColor: theme.primary, color: theme.primary })
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  Object.assign((e.target as HTMLElement).style, { borderColor: theme.border, color: theme.text })
                }
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
      {showMaxMessage && (
        <div style={{ ...s.infoMessage, marginTop: 12 }}>
          For groups of more than {maxPartySize} people, please call us on{' '}
          <strong>{phone}</strong>.
        </div>
      )}
    </div>
  )
}

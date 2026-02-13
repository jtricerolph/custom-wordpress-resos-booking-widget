import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { ThemeColors } from '../utils/theme'
import type { CustomFieldDef, CustomFieldValue, MultipleChoiceSelection } from '../types'
import { styles } from '../utils/theme'

interface CustomFieldsProps {
  theme: ThemeColors
  fields: CustomFieldDef[]
  values: CustomFieldValue[]
  onChange: (values: CustomFieldValue[]) => void
}

export default function CustomFields({ theme, fields, values, onChange }: CustomFieldsProps) {
  const s = styles(theme)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const sorted = [...fields].sort((a, b) => a.sortIndex - b.sortIndex)

  function getValue(fieldId: string): CustomFieldValue | undefined {
    return values.find(v => v._id === fieldId)
  }

  function updateValue(field: CustomFieldDef, value: string | MultipleChoiceSelection[], multipleChoiceValueName?: string) {
    const updated = values.filter(v => v._id !== field._id)
    updated.push({
      _id: field._id,
      name: field.name,
      value,
      ...(multipleChoiceValueName ? { multipleChoiceValueName } : {}),
    })
    onChange(updated)
  }

  function renderStringField(field: CustomFieldDef) {
    const current = getValue(field._id)
    const val = (current?.value as string) || ''
    const isFocused = focusedField === field._id

    return (
      <input
        type="text"
        value={val}
        style={{ ...s.input, ...(isFocused ? s.inputFocus : {}) }}
        onFocus={() => setFocusedField(field._id)}
        onBlur={() => setFocusedField(null)}
        onChange={(e) => updateValue(field, e.target.value)}
      />
    )
  }

  function renderRadioField(field: CustomFieldDef) {
    const current = getValue(field._id)
    const selectedId = current?.value
      ? (Array.isArray(current.value) ? current.value[0]?._id : null)
      : null

    const radioStyle: CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
    }

    return (
      <div style={radioStyle}>
        {field.multipleChoiceSelections?.map(choice => {
          const isSelected = selectedId === choice._id
          return (
            <button
              key={choice._id}
              type="button"
              style={{
                ...s.button,
                ...(isSelected ? s.buttonSelected : {}),
                fontSize: 13,
                padding: '6px 12px',
              }}
              onClick={() => updateValue(field, [{ _id: choice._id, name: choice.name }], choice.name)}
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
              {choice.name}
            </button>
          )
        })}
      </div>
    )
  }

  function renderDropdownField(field: CustomFieldDef) {
    const current = getValue(field._id)
    const selectedId = current?.value
      ? (Array.isArray(current.value) ? current.value[0]?._id : null)
      : null
    const isFocused = focusedField === field._id

    return (
      <select
        value={selectedId || ''}
        style={{ ...s.input, ...(isFocused ? s.inputFocus : {}), cursor: 'pointer' }}
        onFocus={() => setFocusedField(field._id)}
        onBlur={() => setFocusedField(null)}
        onChange={(e) => {
          const choice = field.multipleChoiceSelections?.find(c => c._id === e.target.value)
          if (choice) {
            updateValue(field, [{ _id: choice._id, name: choice.name }], choice.name)
          }
        }}
      >
        <option value="">Select…</option>
        {field.multipleChoiceSelections?.map(choice => (
          <option key={choice._id} value={choice._id}>{choice.name}</option>
        ))}
      </select>
    )
  }

  function renderCheckboxField(field: CustomFieldDef) {
    const current = getValue(field._id)
    const selectedIds = current?.value
      ? (Array.isArray(current.value) ? current.value.map(v => v._id) : [])
      : []

    const checkboxStyle: CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
    }

    return (
      <div style={checkboxStyle}>
        {field.multipleChoiceSelections?.map(choice => {
          const isSelected = selectedIds.includes(choice._id)
          return (
            <button
              key={choice._id}
              type="button"
              style={{
                ...s.button,
                ...(isSelected ? s.buttonSelected : {}),
                fontSize: 13,
                padding: '6px 12px',
              }}
              onClick={() => {
                let newSelections: MultipleChoiceSelection[]
                if (isSelected) {
                  newSelections = (current?.value as MultipleChoiceSelection[]).filter(v => v._id !== choice._id)
                } else {
                  newSelections = [...(current?.value as MultipleChoiceSelection[] || []), { _id: choice._id, name: choice.name }]
                }
                const names = newSelections.map(s => s.name).join(', ')
                updateValue(field, newSelections, names)
              }}
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
              {choice.name}
            </button>
          )
        })}
      </div>
    )
  }

  if (sorted.length === 0) return null

  const fieldGroupStyle: CSSProperties = {
    marginBottom: 16,
  }

  return (
    <div>
      {sorted.map(field => (
        <div key={field._id} style={fieldGroupStyle}>
          <label style={s.label}>
            {field.label || field.name}
            {field.isRequired && <span style={{ color: theme.error }}> *</span>}
          </label>
          {field.helptext && <div style={s.helptext}>{field.helptext}</div>}
          <div style={{ marginTop: 4 }}>
            {field.type === 'string' && renderStringField(field)}
            {field.type === 'radio' && renderRadioField(field)}
            {field.type === 'dropdown' && renderDropdownField(field)}
            {field.type === 'checkbox' && renderCheckboxField(field)}
          </div>
        </div>
      ))}
    </div>
  )
}

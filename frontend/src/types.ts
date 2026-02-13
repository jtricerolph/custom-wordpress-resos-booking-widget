export interface WidgetConfig {
  restUrl: string
  nonce: string
  phone: string
  turnstileSiteKey: string
  maxPartySize: number
  maxBookingWindow: number
  colourPreset: 'warm' | 'light' | 'dark' | 'cold'
  mappedFieldIds: {
    hotelGuest: string
    bookingRef: string
  }
}

declare global {
  interface Window {
    rbwConfig: WidgetConfig
    turnstile?: {
      reset: () => void
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string
    }
  }
}

export interface OpeningHourPeriod {
  id: string
  name: string
  from: string
  to: string
  is_special: boolean
  resident_only: boolean
  display_message: string | null
}

export interface MultipleChoiceSelection {
  _id: string
  name: string
}

export interface CustomFieldDef {
  _id: string
  name: string
  type: 'string' | 'radio' | 'dropdown' | 'checkbox'
  isRequired: boolean
  label: string
  helptext?: string
  sortIndex: number
  multipleChoiceSelections?: MultipleChoiceSelection[]
}

export interface TimeSlotResponse {
  times: string[]
  activeCustomFields: CustomFieldDef[]
}

export interface DuplicateCheckResult {
  duplicate: true
  existing_time: string
  existing_people: number
}

export interface BookingSuccessResult {
  success: true
  booking_id: string
}

export type CreateBookingResult = DuplicateCheckResult | BookingSuccessResult

export interface CustomFieldValue {
  _id: string
  name: string
  value: string | MultipleChoiceSelection[]
  multipleChoiceValueName?: string
}

export interface GuestDetails {
  name: string
  email: string
  phone: string
  notes: string
}

export type BookingStep =
  | 'date'
  | 'party_size'
  | 'time_selection'
  | 'guest_details'
  | 'submitting'
  | 'confirmation'

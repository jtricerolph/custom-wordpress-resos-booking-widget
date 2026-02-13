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

export interface AllPeriodsTimesResponse {
  periods: Record<string, TimeSlotResponse>
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

// Phase 2: Resident / Stay Planner types

export interface ResidentInfo {
  verified: boolean
  guest_name: string
  guest_email: string
  guest_phone: string
  room: string
  check_in: string
  check_out: string
  nights: string[]
  booking_id: number
  occupancy: number
  group_id: number | null
}

export interface ResidentVerifyError {
  verified: false
  error: string
}

export type ResidentVerifyResult = ResidentInfo | ResidentVerifyError

export interface StayPeriod {
  id: string
  name: string
  from: string
  to: string
  is_special: boolean
  resident_only: boolean
  display_message: string | null
  times: string[]
}

export interface StayDateData {
  error: boolean
  periods: StayPeriod[]
}

export type MultiDateTimesResult = Record<string, StayDateData>

export interface StayNightSelection {
  date: string
  periodId: string
  periodName: string
  time: string
  people: number
}

export interface BatchBookingResult {
  date: string
  success: boolean
  booking_id?: string
  error?: string
}

export interface BatchCreateResult {
  results: BatchBookingResult[]
}

// Phase 3: Resident matching types

export interface ResidentMatchResult {
  match_tier: 0 | 1 | 2 | 3
  message?: string
  booking_id?: number
  booking_reference_id?: string
  check_in?: string
  check_out?: string
  nights?: string[]
  room?: string
  occupancy?: number
  group_id?: number | null
  phone_on_file?: boolean
}

export interface PhoneVerifyResult {
  verified: boolean
  booking_id?: number
  check_in?: string
  check_out?: string
  nights?: string[]
  room?: string
  occupancy?: number
  group_id?: number | null
}

export interface ReferenceVerifyResult {
  verified: boolean
  booking_id?: number
  ota_match?: boolean
  travel_agent_name?: string
  internal_booking_id?: number
}

export interface GroupCheckResult {
  is_group: boolean
  group_size?: number
  group_occupancy_total?: number
  guest_occupancy?: number
  existing_tables?: Array<{
    newbook_booking_id: string
    covers: number
  }>
}

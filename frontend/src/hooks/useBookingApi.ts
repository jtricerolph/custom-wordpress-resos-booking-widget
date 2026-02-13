import type {
  OpeningHourPeriod, TimeSlotResponse, CreateBookingResult, CustomFieldValue,
  ResidentVerifyResult, MultiDateTimesResult, BatchCreateResult, StayNightSelection,
  ResidentMatchResult, PhoneVerifyResult, ReferenceVerifyResult, GroupCheckResult,
} from '../types'

function getConfig() {
  const config = window.rbwConfig || ({} as typeof window.rbwConfig)
  return {
    restUrl: config.restUrl || '/wp-json/rbw/v1/',
    nonce: config.nonce || '',
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { restUrl, nonce } = getConfig()
  const url = restUrl + endpoint

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (nonce) {
    headers['X-WP-Nonce'] = nonce
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${response.status})`)
  }

  return response.json()
}

export function useBookingApi() {
  async function fetchOpeningHours(date: string): Promise<OpeningHourPeriod[]> {
    return apiFetch<OpeningHourPeriod[]>(`opening-hours?date=${encodeURIComponent(date)}`)
  }

  async function fetchAvailableTimes(
    date: string,
    people: number,
    openingHourId: string
  ): Promise<TimeSlotResponse> {
    return apiFetch<TimeSlotResponse>('available-times', {
      method: 'POST',
      body: JSON.stringify({
        date,
        people,
        opening_hour_id: openingHourId,
      }),
    })
  }

  async function createBooking(params: {
    date: string
    time: string
    people: number
    name: string
    email: string
    phone?: string
    notes?: string
    custom_fields?: CustomFieldValue[]
    turnstile_token?: string
    force_duplicate?: boolean
    resident_booking_id?: number
  }): Promise<CreateBookingResult> {
    return apiFetch<CreateBookingResult>('create-booking', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // Phase 2: Resident verification
  async function verifyResident(params: {
    bid: number
    gid?: number
    surname?: string
    email?: string
    phone?: string
  }): Promise<ResidentVerifyResult> {
    return apiFetch<ResidentVerifyResult>('verify-resident', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // Phase 2: Multi-date time slots for stay planner
  async function fetchAvailableTimesMulti(
    dates: string[],
    people: number,
    residentBookingId?: number
  ): Promise<MultiDateTimesResult> {
    return apiFetch<MultiDateTimesResult>('available-times-multi', {
      method: 'POST',
      body: JSON.stringify({
        dates,
        people,
        resident_booking_id: residentBookingId,
      }),
    })
  }

  // Phase 2: Batch booking creation
  async function createBookingsBatch(params: {
    bookings: StayNightSelection[]
    name: string
    email: string
    phone?: string
    notes?: string
    custom_fields?: CustomFieldValue[]
    resident_booking_id?: number
    turnstile_token?: string
  }): Promise<BatchCreateResult> {
    return apiFetch<BatchCreateResult>('create-bookings-batch', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // Phase 2: Mark nights as no table needed
  async function markNoTable(bookingId: number, dates: string[]): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('mark-no-table', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId, dates }),
    })
  }

  // Phase 3: Check resident match during Flow A
  async function checkResident(date: string, name: string, email: string, phone?: string): Promise<ResidentMatchResult> {
    return apiFetch<ResidentMatchResult>('check-resident', {
      method: 'POST',
      body: JSON.stringify({ date, name, email, phone }),
    })
  }

  // Phase 3: Verify phone for Tier 2 match
  async function verifyResidentPhone(date: string, name: string, phone: string): Promise<PhoneVerifyResult> {
    return apiFetch<PhoneVerifyResult>('verify-resident-phone', {
      method: 'POST',
      body: JSON.stringify({ date, name, phone }),
    })
  }

  // Phase 3: Verify manual booking reference
  async function verifyResidentReference(date: string, reference: string): Promise<ReferenceVerifyResult> {
    return apiFetch<ReferenceVerifyResult>('verify-resident-reference', {
      method: 'POST',
      body: JSON.stringify({ date, reference }),
    })
  }

  // Phase 3: Check group status
  async function checkGroup(date: string, bookingId: number, groupId: number, covers: number): Promise<GroupCheckResult> {
    return apiFetch<GroupCheckResult>('check-group', {
      method: 'POST',
      body: JSON.stringify({ date, booking_id: bookingId, group_id: groupId, covers }),
    })
  }

  return {
    fetchOpeningHours, fetchAvailableTimes, createBooking,
    verifyResident, fetchAvailableTimesMulti, createBookingsBatch, markNoTable,
    checkResident, verifyResidentPhone, verifyResidentReference, checkGroup,
  }
}

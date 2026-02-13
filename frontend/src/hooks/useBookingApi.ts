import type { OpeningHourPeriod, TimeSlotResponse, CreateBookingResult, CustomFieldValue } from '../types'

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
  }): Promise<CreateBookingResult> {
    return apiFetch<CreateBookingResult>('create-booking', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  return { fetchOpeningHours, fetchAvailableTimes, createBooking }
}

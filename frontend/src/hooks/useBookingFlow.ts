import { useState, useCallback } from 'react'
import type {
  BookingStep,
  OpeningHourPeriod,
  CustomFieldDef,
  GuestDetails,
  CustomFieldValue,
  DuplicateCheckResult,
  PeriodData,
} from '../types'

export interface BookingFlowState {
  step: BookingStep
  date: string | null
  people: number | null
  periods: OpeningHourPeriod[]
  allPeriodTimes: Record<string, PeriodData>
  selectedPeriodId: string | null
  selectedTime: string | null
  activeCustomFields: CustomFieldDef[]
  guestDetails: GuestDetails
  customFieldValues: CustomFieldValue[]
  bookingId: string | null
  duplicateWarning: DuplicateCheckResult | null
  error: string | null
  loading: boolean
}

const initialGuestDetails: GuestDetails = {
  name: '',
  email: '',
  phone: '',
  notes: '',
}

export function useBookingFlow() {
  const [state, setState] = useState<BookingFlowState>({
    step: 'date',
    date: null,
    people: null,
    periods: [],
    allPeriodTimes: {},
    selectedPeriodId: null,
    selectedTime: null,
    activeCustomFields: [],
    guestDetails: { ...initialGuestDetails },
    customFieldValues: [],
    bookingId: null,
    duplicateWarning: null,
    error: null,
    loading: false,
  })

  const setDate = useCallback((date: string, periods: OpeningHourPeriod[]) => {
    setState(prev => ({
      ...prev,
      date,
      periods,
      step: 'party_size',
      loading: false,
      // Reset downstream
      people: null,
      allPeriodTimes: {},
      selectedPeriodId: null,
      selectedTime: null,
      activeCustomFields: [],
      guestDetails: { ...initialGuestDetails },
      customFieldValues: [],
      bookingId: null,
      duplicateWarning: null,
      error: null,
    }))
  }, [])

  const setPeople = useCallback((people: number) => {
    setState(prev => ({
      ...prev,
      people,
      step: 'time_selection',
      allPeriodTimes: {},
      loading: false,
      // Reset downstream
      selectedPeriodId: null,
      selectedTime: null,
      activeCustomFields: [],
      guestDetails: { ...initialGuestDetails },
      customFieldValues: [],
      duplicateWarning: null,
      error: null,
    }))
  }, [])

  const setAllPeriodTimes = useCallback((periodTimes: Record<string, PeriodData>) => {
    setState(prev => ({ ...prev, allPeriodTimes: periodTimes }))
  }, [])

  const setSelectedPeriod = useCallback((periodId: string) => {
    setState(prev => ({
      ...prev,
      selectedPeriodId: periodId,
      selectedTime: null,
      activeCustomFields: [],
      customFieldValues: [],
    }))
  }, [])

  const setSelectedTime = useCallback((time: string, customFields: CustomFieldDef[]) => {
    setState(prev => ({
      ...prev,
      selectedTime: time,
      activeCustomFields: customFields,
      step: 'guest_details',
      customFieldValues: [],
      duplicateWarning: null,
      error: null,
    }))
  }, [])

  const setGuestDetails = useCallback((details: Partial<GuestDetails>) => {
    setState(prev => ({
      ...prev,
      guestDetails: { ...prev.guestDetails, ...details },
    }))
  }, [])

  const setCustomFieldValues = useCallback((values: CustomFieldValue[]) => {
    setState(prev => ({
      ...prev,
      customFieldValues: values,
    }))
  }, [])

  const setDuplicateWarning = useCallback((warning: DuplicateCheckResult | null) => {
    setState(prev => ({
      ...prev,
      duplicateWarning: warning,
    }))
  }, [])

  const setBookingConfirmed = useCallback((bookingId: string) => {
    setState(prev => ({
      ...prev,
      step: 'confirmation',
      bookingId,
      loading: false,
    }))
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, loading: false }))
  }, [])

  const setSubmitting = useCallback(() => {
    setState(prev => ({ ...prev, step: 'submitting', loading: true, error: null }))
  }, [])

  const resetToDate = useCallback(() => {
    setState({
      step: 'date',
      date: null,
      people: null,
      periods: [],
      allPeriodTimes: {},
      selectedPeriodId: null,
      selectedTime: null,
      activeCustomFields: [],
      guestDetails: { ...initialGuestDetails },
      customFieldValues: [],
      bookingId: null,
      duplicateWarning: null,
      error: null,
      loading: false,
    })
  }, [])

  const goBackToParty = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: 'party_size' as BookingStep,
      allPeriodTimes: {},
      selectedPeriodId: null,
      selectedTime: null,
      activeCustomFields: [],
      guestDetails: { ...initialGuestDetails },
      customFieldValues: [],
      duplicateWarning: null,
      error: null,
      loading: false,
    }))
  }, [])

  const goBackToTime = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: 'time_selection' as BookingStep,
      selectedTime: null,
      activeCustomFields: [],
      guestDetails: { ...initialGuestDetails },
      customFieldValues: [],
      duplicateWarning: null,
      error: null,
      loading: false,
    }))
  }, [])

  // Get the selected period name for display (from bookingFlow/times data)
  const selectedPeriodName = state.selectedPeriodId
    ? (state.allPeriodTimes[state.selectedPeriodId]?.name || '')
    : ''

  return {
    state,
    selectedPeriodName,
    setDate,
    setPeople,
    setAllPeriodTimes,
    setSelectedPeriod,
    setSelectedTime,
    setGuestDetails,
    setCustomFieldValues,
    setDuplicateWarning,
    setBookingConfirmed,
    setLoading,
    setError,
    setSubmitting,
    resetToDate,
    goBackToParty,
    goBackToTime,
  }
}

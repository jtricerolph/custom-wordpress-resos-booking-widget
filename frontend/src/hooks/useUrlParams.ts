import { useMemo } from 'react'

export interface UrlParams {
  date: string | null
  people: number | null
  name: string | null
  email: string | null
  phone: string | null
  bid: number | null
  gid: number | null
}

export function useUrlParams(): UrlParams {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search)

    const date = params.get('date')
    const peopleStr = params.get('people')
    const name = params.get('name')
    const email = params.get('email')
    const phone = params.get('phone')
    const bidStr = params.get('bid')
    const gidStr = params.get('gid')

    return {
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      people: peopleStr ? parseInt(peopleStr, 10) || null : null,
      name: name || null,
      email: email || null,
      phone: phone || null,
      bid: bidStr ? parseInt(bidStr, 10) || null : null,
      gid: gidStr ? parseInt(gidStr, 10) || null : null,
    }
  }, [])
}

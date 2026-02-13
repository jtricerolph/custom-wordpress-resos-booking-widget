export function validateEmail(email: string): boolean {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePhone(phone: string): boolean {
  if (!phone) return true // phone is optional
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

export function validateName(name: string): boolean {
  return name.trim().length >= 2
}

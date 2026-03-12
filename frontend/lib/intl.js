function withLatinDigits(locale) {
  const rawLocale = String(locale || 'en-US')
  if (/-u-nu-[a-z0-9]+/i.test(rawLocale)) {
    return rawLocale.replace(/-u-nu-[a-z0-9]+/i, '-u-nu-latn')
  }
  return `${rawLocale}-u-nu-latn`
}

export function toEnglishDigits(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
}

export function digitsOnly(value) {
  return toEnglishDigits(value).replace(/[^\d]/g, '')
}

export function getUserLocale(fallback = 'en-US') {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language
  }

  if (typeof document !== 'undefined') {
    const lang = document.documentElement?.lang
    if (lang) return lang
  }

  return fallback
}

export function formatDecimal(value, options = {}) {
  const {
    locale = getUserLocale(),
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options

  const numericValue = Number(value ?? 0)
  return new Intl.NumberFormat(withLatinDigits(locale), {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Number.isFinite(numericValue) ? numericValue : 0)
}

export function formatMoney(value, currencySymbol, options = {}) {
  const formatted = formatDecimal(value, options)
  return currencySymbol ? `${formatted} ${currencySymbol}` : formatted
}

export function formatDateTime(value, options = {}) {
  const { locale = 'ar-SA', dateStyle = 'medium', timeStyle = 'short' } = options
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat(withLatinDigits(locale), { dateStyle, timeStyle }).format(date)
}

export function formatDate(value, options = {}) {
  const { locale = 'ar-SA', dateStyle = 'medium' } = options
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat(withLatinDigits(locale), { dateStyle }).format(date)
}

export function formatTime(value, options = {}) {
  const { locale = 'ar-SA', timeStyle = 'short' } = options
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat(withLatinDigits(locale), { timeStyle }).format(date)
}

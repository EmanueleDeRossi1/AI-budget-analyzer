import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(value: number) {
  return Number(value).toLocaleString('en-US', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  })
}

/**
 * Normalize a user-typed amount string to a plain decimal string the API can
 * parse (e.g. "1.234,56" → "1234.56", "50,000" → "50000", "1,5" → "1.5").
 *
 * Rules:
 *  - If both . and , are present, the LAST one is the decimal separator;
 *    the other is a thousands separator and gets stripped.
 *  - If only , is present: if it's followed by exactly 3 digits it's a
 *    thousands separator (strip it); otherwise it's a decimal (→ ".").
 *  - If only . is present: same logic as above but in reverse.
 *  - Strip all remaining thousands separators after the above pass.
 */
export function normalizeAmount(raw: string): string {
  const s = raw.trim()
  if (!s || s === '-') return s

  const lastDot   = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')

  if (lastDot !== -1 && lastComma !== -1) {
    // Both present — whichever comes last is the decimal separator
    if (lastDot > lastComma) {
      // "1,234.56" — commas are thousands
      return s.replace(/,/g, '')
    } else {
      // "1.234,56" — dots are thousands
      return s.replace(/\./g, '').replace(',', '.')
    }
  }

  if (lastComma !== -1 && lastDot === -1) {
    // Only commas — thousands separator if exactly 3 digits follow each comma
    const afterComma = s.slice(lastComma + 1)
    if (/^\d{3}$/.test(afterComma)) {
      // e.g. "50,000" — strip the comma
      return s.replace(/,/g, '')
    }
    // e.g. "1,5" or "1,50" — decimal separator
    return s.replace(',', '.')
  }

  if (lastDot !== -1 && lastComma === -1) {
    // Only dots — same heuristic
    const afterDot = s.slice(lastDot + 1)
    if (/^\d{3}$/.test(afterDot) && s.replace(/\./g, '').length > 4) {
      // e.g. "50.000" — strip the dot (thousands)
      return s.replace(/\./g, '')
    }
    // e.g. "1.5" — already a valid decimal
    return s
  }

  return s
}

/** Filter a raw input string to only valid numeric characters (digits, . , - at start). */
export function filterNumericInput(raw: string): string {
  // Allow an optional leading minus, then digits with optional . or ,
  return raw.replace(/[^\d.,-]/g, '')
}

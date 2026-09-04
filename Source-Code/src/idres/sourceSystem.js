export const SOURCE_SYSTEM_STORAGE_KEY = 'cdp_source_system'

export const SOURCE_SYSTEMS = ['media', 'sports', 'automotive', 'telecom']

export const SOURCE_SYSTEM_LABELS = {
  media: 'Media & OTT',
  sports: 'Sports',
  automotive: 'Automotive',
  telecom: 'Telecom',
}

export function normalizeSourceSystem(value, fallback = 'media') {
  const candidate = String(value || '').trim().toLowerCase()
  return SOURCE_SYSTEMS.includes(candidate) ? candidate : fallback
}

export function readSelectedSourceSystem(fallback = 'media') {
  if (typeof window === 'undefined') return fallback
  try {
    return normalizeSourceSystem(window.localStorage.getItem(SOURCE_SYSTEM_STORAGE_KEY), fallback)
  } catch {
    return fallback
  }
}

export function writeSelectedSourceSystem(value) {
  const normalized = normalizeSourceSystem(value)
  if (typeof window === 'undefined') return normalized

  try {
    if (window.localStorage.getItem(SOURCE_SYSTEM_STORAGE_KEY) !== normalized) {
      window.localStorage.setItem(SOURCE_SYSTEM_STORAGE_KEY, normalized)
    }
    window.dispatchEvent(new CustomEvent('cdp-source-system-change', { detail: normalized }))
  } catch { }

  return normalized
}

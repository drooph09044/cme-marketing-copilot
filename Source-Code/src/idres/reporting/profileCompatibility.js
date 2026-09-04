const PROFILE_ENDPOINT = '/api/reporting/customer-profiles'

async function readJson(response) {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(
      payload?.error
      || payload?.message
      || `Customer profile reporting request failed (${response.status}).`
    )
    error.status = response.status
    throw error
  }
  return payload
}

export async function fetchCustomerProfileReport(source, signal) {
  const query = `source=${encodeURIComponent(source)}`
  const response = await fetch(`${PROFILE_ENDPOINT}?${query}`, {
    signal,
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })

  if (response.ok) {
    const payload = await readJson(response)
    const returnedSource = String(payload?.source_system || '').trim().toLowerCase()
    if (returnedSource !== source) {
      throw new Error('The customer profile reporting API returned data for a different source system.')
    }
    return payload
  }

  if (response.status === 404) {
    const error = new Error(
      'Full customer profile reporting API is not loaded in the running backend. '
      + 'Restart backend/app.py from this workspace; reduced summary data is not shown as a complete report.'
    )
    error.status = 404
    throw error
  }

  return readJson(response)
}

export async function fetchCustomerProfileActivityProfiles(
  source,
  status,
  page = 1,
  pageSize = 25,
  signal
) {
  const query = new URLSearchParams({
    source,
    status,
    page: String(page),
    page_size: String(pageSize),
  })
  const response = await fetch(
    `${PROFILE_ENDPOINT}/activity-profiles?${query.toString()}`,
    {
      signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    }
  )
  return readJson(response)
}

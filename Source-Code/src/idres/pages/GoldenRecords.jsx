import React, { useState, useEffect } from 'react'
import { api } from '../api'
import Pagination from '../components/Pagination'
import { readSelectedSourceSystem } from '../sourceSystem'

function srcLabel(s) {
  if (!s) return '-'
  return String(s)
    .split(/[\\/]/)
    .pop()
    .replace(/\.csv$/i, '')
    .replace(/^(aut|auto|med|spt|tel)_/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function recordLabel(recordId) {
  const value = String(recordId || '').trim()
  if (!value) return '-'
  const parts = value.split(':')
  if (parts.length >= 2 && /(?:^|\/|\\)[a-z]+_.*\.csv$/i.test(parts[0])) {
    return parts[1] || value
  }
  return value
}

function ProvenancePanel({ provenance, goldenId }) {
  const [openField, setOpenField] = useState(null)
  if (!provenance) return null
  const fields = Object.entries(provenance).filter(([, p]) => p.candidates && p.candidates.length > 0)
  if (fields.length === 0) {
    return <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>No provenance data for this record.</div>
  }
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, color: 'var(--text-primary)' }}>
        Field Provenance: {goldenId}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        For each field, shows all available source values and explains why a particular value was selected.
      </div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Field</th>
              <th style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Chosen Value</th>
              <th style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Source</th>
              <th style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Selection Rule</th>
              <th style={{ width: 50, color: 'var(--text-primary)', fontWeight: 700 }}>Options</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(([field, prov]) => {
              const isOpen = openField === field
              const candidateCount = prov.candidates.length
              const uniqueSources = [...new Set(prov.candidates.map(c => c.source))]
              return (
                <>
                  <tr key={field} className="expandable-row" onClick={() => setOpenField(isOpen ? null : field)} style={{ cursor: 'pointer' }}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{isOpen ? '\u25BC' : '\u25B6'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{field.replace(/_/g, ' ')}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                      {prov.chosen_value || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,102,204,0.12)', color: 'var(--accent)' }}>
                        {srcLabel(prov.chosen_source)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 500 }}>
                        {prov.rule}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>{candidateCount}</td>
                  </tr>
                  {isOpen && (
                    <tr key={`${field}-detail`}>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <div style={{ padding: '12px 16px 16px 46px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <strong style={{ color: '#22c55e' }}>Why this value?</strong> {prov.reason}
                            {prov.chosen_record && (
                              <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>(from record <code>{recordLabel(prov.chosen_record)}</code>)</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
                            All Available Values ({candidateCount} from {uniqueSources.length} source{uniqueSources.length > 1 ? 's' : ''})
                          </div>
                          <table className="data-table" style={{ fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ width: 30 }}></th>
                                <th style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Value</th>
                                <th style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Source</th>
                                <th style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Record ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {prov.candidates.map((c, i) => {
                                const isChosen = c.value === prov.chosen_value && c.source === prov.chosen_source && c.record_id === prov.chosen_record
                                return (
                                  <tr key={i} style={{ background: isChosen ? 'rgba(34,197,94,0.08)' : undefined }}>
                                    <td style={{ textAlign: 'center' }}>
                                      {isChosen && <span style={{ color: '#22c55e', fontSize: 14 }}>&#10003;</span>}
                                    </td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: isChosen ? 700 : 400, color: isChosen ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                      {c.value}
                                    </td>
                                    <td>
                                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: isChosen ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.12)', color: isChosen ? '#22c55e' : 'var(--text-muted)' }}>
                                        {srcLabel(c.source)}
                                      </span>
                                    </td>
                                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{recordLabel(c.record_id)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function GoldenRecords() {
  const [records, setRecords] = useState({ columns: [], rows: [], total: 0, page: 1, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [expanded, setExpanded] = useState(null)
  const [provenance, setProvenance] = useState(null)
  const [provLoading, setProvLoading] = useState(false)
  const [sourceSystem, setSourceSystem] = useState(readSelectedSourceSystem)

  const fetchRecords = (p, s, ps, src = sourceSystem) => {
    setLoading(true)
    setLoadError('')
    api.getGoldenRecords(p, ps, s, src)
      .then(d => { setRecords(d); setLoading(false) })
      .catch((error) => {
        setRecords({ columns: [], rows: [], total: 0, page: p, pages: 0 })
        setLoadError(error?.message || 'Unable to read Golden Records from Unity Catalog.')
        setLoading(false)
      })
  }

  useEffect(() => {
    setPage(1)
    setExpanded(null)
    setProvenance(null)
    fetchRecords(1, search, pageSize, sourceSystem)
  }, [sourceSystem])

  useEffect(() => {
    const syncSourceSystem = () => {
      const nextSource = readSelectedSourceSystem()
      setSourceSystem(current => (current === nextSource ? current : nextSource))
    }
    window.addEventListener('focus', syncSourceSystem)
    window.addEventListener('storage', syncSourceSystem)
    window.addEventListener('cdp-source-system-change', syncSourceSystem)
    return () => {
      window.removeEventListener('focus', syncSourceSystem)
      window.removeEventListener('storage', syncSourceSystem)
      window.removeEventListener('cdp-source-system-change', syncSourceSystem)
    }
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchRecords(1, search, pageSize)
  }

  const goPage = (p) => { setPage(p); fetchRecords(p, search, pageSize) }
  const handlePageSize = (newSize) => { setPageSize(newSize); setPage(1); fetchRecords(1, search, newSize) }

  const toggleExpand = async (goldenId) => {
    if (expanded === goldenId) { setExpanded(null); setProvenance(null); return }
    setExpanded(goldenId)
    setProvLoading(true)
    try { const data = await api.getProvenance(goldenId, sourceSystem); setProvenance(data) }
    catch { setProvenance(null) }
    setProvLoading(false)
  }

  const displayCols = ['golden_id', 'household_id', 'email', 'full_name', 'phone', 'address', 'city', 'state', 'zip', 'subscription_tier', 'record_count']

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Golden Records</h1>
        <p className="page-description">Consolidated identity records after merging all source data</p>
      </div>
      <div className="page-body">
        {loadError && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: '14px 16px',
              borderRadius: 10,
              border: '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(239,68,68,0.08)',
              color: '#fca5a5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Golden Records are temporarily unavailable</div>
              <div style={{ marginTop: 4, fontSize: 12 }}>{loadError}</div>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => fetchRecords(page, search, pageSize)}>Retry</button>
          </div>
        )}
        <div className="flex-between mb-24">
          <form onSubmit={handleSearch} className="search-box">
            <span className="search-icon">&#128269;</span>
            <input placeholder="Search by name, email, phone, ID, household..." value={search} onChange={e => setSearch(e.target.value)} />
          </form>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{records.total.toLocaleString()} golden records</span>
        </div>
        <div className="card">
          <div className="data-table-wrapper" style={{ maxHeight: 600, overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  {displayCols.map(c => (
                    <th key={c} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{c.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={displayCols.length + 1} className="loading"><div className="spinner" /> Loading...</td></tr>
                ) : records.rows.map(row => (
                  <React.Fragment key={row.golden_id}>
                    <tr className="expandable-row" onClick={() => toggleExpand(row.golden_id)}>
                      <td style={{ width: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                        {expanded === row.golden_id ? '\u25BC' : '\u25B6'}
                      </td>
                      {displayCols.map(c => (
                        <td key={c} style={
                          c === 'golden_id' ? { fontWeight: 600, color: 'var(--accent-light)' } :
                          c === 'household_id' ? { fontWeight: 600, color: '#8b5cf6' } :
                          { color: 'var(--text-primary)' }
                        }>
                          {c === 'subscription_tier' ? (
                            <span className="badge badge-strong">{row[c]}</span>
                          ) : row[c] || '-'}
                        </td>
                      ))}
                    </tr>
                    {expanded === row.golden_id && (
                      <tr className="expanded-content">
                        <td colSpan={displayCols.length + 1}>
                          <div style={{ padding: '12px 8px' }}>
                            {provLoading ? (
                              <div className="loading" style={{ padding: 24 }}><div className="spinner" /> Loading provenance...</div>
                            ) : (
                              <ProvenancePanel provenance={provenance} goldenId={row.golden_id} />
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={records.pages} pageSize={pageSize} total={records.total} onPage={goPage} onPageSize={handlePageSize} pageSizeOptions={[10, 25, 50, 100]} />
        </div>
      </div>
    </>
  )
}

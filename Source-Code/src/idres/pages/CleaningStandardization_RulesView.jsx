import React, { useState, useEffect } from 'react'
import { api } from '../api'

const SOURCE_SYSTEMS = ['media', 'sports', 'automotive']
const SOURCE_SYSTEM_LABELS = {
  media: 'Media',
  sports: 'Sports',
  automotive: 'Automotive',
}

const STANDARDIZATION_FIELDS = [
  'customer_id',
  'account_id',
  'loyalty_id',
  'vehicle_id',
  'device_id',
  'email',
  'full_name',
  'first_name',
  'last_name',
  'date_of_birth',
  'phone',
  'address',
  'city',
  'state',
  'zip',
]

const IDENTIFIER_STANDARDIZATION_FIELDS = new Set([
  'customer_id',
  'account_id',
  'loyalty_id',
  'vehicle_id',
  'device_id',
])

function readSelectedSourceSystem() {
  try {
    const saved = window.localStorage.getItem('cdp_source_system')
    return SOURCE_SYSTEMS.includes(saved) ? saved : 'media'
  } catch {
    return 'media'
  }
}

function formatFieldName(field) {
  return String(field || '').replace(/_/g, ' ').toUpperCase()
}

function formatExampleRecordId(recordId, index) {
  const value = String(recordId || '')
  if (/^[A-Z]{3}-DQ-\d{4}$/i.test(value)) return value.toUpperCase()
  return `DQ-${String(index + 1).padStart(4, '0')}`
}

export default function CleaningStandardization_RulesView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sourceSystem, setSourceSystem] = useState(readSelectedSourceSystem)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [expandedField, setExpandedField] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    setSelectedIdx(0)
    setExpandedField(null)
    api.getStandardizationSummary(sourceSystem)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => {
        setError(e?.message || 'Failed to load standardization data')
        setLoading(false)
      })
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

  if (loading) return <div className="loading"><div className="spinner" /> Loading standardization data...</div>
  if (error) return (
    <div className="empty-state">
      <div className="empty-state-title">Unable to load standardization data</div>
      <p>{error}</p>
    </div>
  )
  const comparisons = (data?.comparisons || []).filter(c => {
    const raw = c.raw || {}
    const changes = c.changes || {}
    const hasRawValues = Object.values(raw).some(v => v !== undefined && v !== null && String(v).trim() !== '')
    const hasChanges = Object.keys(changes).length > 0 || Number(c.transform_count) > 0
    return hasRawValues && hasChanges
  })
  if (!data || !comparisons.length) return (
    <div className="empty-state">
      <div className="empty-state-title">No standardization data</div>
      <p>Run the preprocessing and standardization steps first.</p>
    </div>
  )

  const comp = comparisons[Math.min(selectedIdx, comparisons.length - 1)]
  const rawData = comp.raw || {}
  const standardizedData = comp.standardized || {}
  const fieldChanges = comp.changes || {}
  const findRawValue = (field) => {
    if (rawData[field] !== undefined && rawData[field] !== null) return rawData[field]
    const compact = field.replace(/_/g, '').toLowerCase()
    const matchingKey = Object.keys(rawData).find(k => k.replace(/_/g, '').toLowerCase().includes(compact))
    return matchingKey ? rawData[matchingKey] : ''
  }
  const fields = (Array.isArray(comp.fields) && comp.fields.length
    ? comp.fields
    : STANDARDIZATION_FIELDS.filter(field =>
      findRawValue(field) || standardizedData[field] || fieldChanges[field]
    )).filter(field => !IDENTIFIER_STANDARDIZATION_FIELDS.has(field))
  const fieldExamples = data.field_examples || {}
  const rules = (data.rules || []).filter(r => String(r.field || '').toLowerCase() !== 'identifier')

  return (
    <>
     
      <div className="">
        {/* Rules with expandable examples */}
        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Standardization</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Field</th>
                  <th>Rule Type</th>
                  <th>Template</th>
                  <th>Rule</th>
                  <th>Status</th>
                  <th style={{ width: 80 }}>Examples</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => {
                  const examples = fieldExamples[r.field] || []
                  const isExpanded = expandedField === r.field

                  return (
                    <React.Fragment key={r.field}>
                      <tr style={{ cursor: examples.length > 0 ? 'pointer' : 'default' }}
                        onClick={() => examples.length > 0 && setExpandedField(isExpanded ? null : r.field)}>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          {examples.length > 0 ? (isExpanded ? '\u25BC' : '\u25B6') : ''}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.field}</td>
                        <td>{r.rule_type || 'Other'}</td>
                        <td>{r.template || r.field}</td>
                        <td>{r.rule}</td>
                        <td>
                          <span className="badge badge-success">
                            Configured
                          </span>
                        </td>
                        <td>
                          {examples.length > 0 && (
                            <span className="badge badge-strong">{examples.length}</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && examples.length > 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                              <table className="data-table" style={{ marginBottom: 0 }}>
                                <thead>
                                  <tr>
                                    <th>Record ID</th>
                                    <th>Before</th>
                                    <th></th>
                                    <th>After</th>
                                    <th>What Changed</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {examples.map((ex, i) => (
                                    <tr key={i}>
                                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatExampleRecordId(ex.record_id, i)}</td>
                                      <td style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 12,
                                        color: 'var(--text-primary)',
                                        background: 'rgba(239,68,68,0.07)',
                                        borderRadius: 4,
                                      }}>
                                        {ex.raw}
                                      </td>
                                      <td style={{ textAlign: 'center', color: 'var(--accent-light)', fontSize: 16, width: 40 }}>
                                        &rarr;
                                      </td>
                                      <td style={{
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: 12,
                                        color: 'var(--text-primary)',
                                        fontWeight: 600,
                                        background: 'rgba(16,185,129,0.08)',
                                        borderRadius: 4,
                                      }}>
                                        {ex.fixed}
                                      </td>
                                      <td>
                                        <span style={{
                                          display: 'inline-block',
                                          padding: '2px 8px',
                                          borderRadius: 10,
                                          fontSize: 11,
                                          fontWeight: 500,
                                          background: 'rgba(59,130,246,0.10)',
                                          color: 'var(--accent-light)',
                                          border: '1px solid rgba(59,130,246,0.18)',
                                        }}>
                                          {ex.label}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* High-Impact Standardization Examples */}
        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Source Data Standardization</span>
          </div>

          {/* Example selector tabs */}
          <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {comparisons.map((c, i) => (
              <button key={i}
                className={`btn btn-sm ${i === selectedIdx ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedIdx(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{formatExampleRecordId(c.record_id, i)}</span>
                {Number(c.transform_count) > 0 && (
                  <span style={{
                    display: 'inline-block',
                    fontSize: 10,
                    fontWeight: 700,
                    background: i === selectedIdx ? 'rgba(255,255,255,0.25)' : 'rgba(59,130,246,0.15)',
                    color: i === selectedIdx ? '#fff' : '#3b82f6',
                    borderRadius: 10,
                    padding: '1px 6px',
                    lineHeight: '16px',
                  }}>
                    {Number(c.transform_count)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Source badge */}
          {comp.source && (
            <div style={{ padding: '12px 16px 0' }}>
              <span style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 12,
                background: 'rgba(107,114,128,0.12)',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}>
                {comp.source}
              </span>
            </div>
          )}

          {/* Comparison grid */}
          <div style={{ padding: '12px 16px 16px' }}>
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div className="comparison-row" style={{ gridTemplateColumns: '110px 1fr 1fr 160px' }}>
                <div className="comparison-cell label">Field</div>
                <div className="comparison-cell label">Raw</div>
                <div className="comparison-cell label">Standardized</div>
                <div className="comparison-cell label">Changes</div>
              </div>

              {fields.map(field => {
                const raw = findRawValue(field)
                const std = standardizedData[field] || ''
                const changed = raw !== std && std !== ''

                /* Detect what kind of transformation happened */
                const explicitChanges = fieldChanges[field]
                const changes = Array.isArray(explicitChanges)
                  ? [...explicitChanges]
                  : (explicitChanges ? [explicitChanges] : [])
                if (!changes.length && changed && raw && std) {
                  const rawLower = (raw || '').toString().toLowerCase()
                  const stdLower = (std || '').toString().toLowerCase()
                  if (std === std.toUpperCase() && raw !== raw.toUpperCase()) changes.push('Uppercased')
                  if (field === 'email') {
                    const rawLocal = raw.includes('@') ? raw.slice(0, raw.indexOf('@')) : raw
                    const stdLocal = std.includes('@') ? std.slice(0, std.indexOf('@')) : std
                    if (rawLocal.includes('+') && stdLocal.includes('+')) changes.push('Plus addressing preserved')
                    if (rawLocal.includes('+') && !stdLocal.includes('+')) changes.push('Plus addressing should be preserved')
                    if (raw.includes('@') && !raw.includes('.', raw.indexOf('@')) && std.includes('.com')) changes.push('Domain fixed')
                    else if (rawLower !== stdLower) changes.push('Typo corrected')
                  }
                  if (field === 'phone') {
                    if (raw.replace(/\D/g, '').length !== std.replace(/\D/g, '').length) changes.push('Digits extracted')
                    else if (/[^0-9]/.test(raw) && /^\d{3}-/.test(std)) changes.push('Formatted')
                  }
                  if (field === 'address') {
                    const abbrs = ['ct', 'st', 'rd', 'dr', 'ave', 'blvd', 'ln', 'ste', 'apt']
                    const expanded = ['court', 'street', 'road', 'drive', 'avenue', 'boulevard', 'lane', 'suite', 'apartment']
                    if (abbrs.some((a, i) => rawLower.includes(a) && stdLower.includes(expanded[i]))) changes.push('Expanded')
                    else if (rawLower !== stdLower) changes.push('Standardized')
                  }
                  if (field === 'zip') {
                    if (raw.includes('-') && !std.includes('-')) changes.push('ZIP+4 stripped')
                    if (std.length === 5 && raw.replace(/-.*/, '').length < 5) changes.push('Zero-padded')
                  }
                  if (field === 'full_name' || field === 'first_name' || field === 'last_name') {
                    if (rawLower !== stdLower && std !== std.toUpperCase()) changes.push('Normalized')
                  }
                  if (changes.length === 0 && changed) changes.push('Cleaned')
                }

                return (
                  <div key={field} className="comparison-row" style={{
                    gridTemplateColumns: '110px 1fr 1fr 160px',
                    borderLeft: changed ? '3px solid var(--accent)' : '3px solid transparent',
                    background: changed ? 'rgba(59,130,246,0.04)' : 'transparent',
                  }}>
                    <div className="comparison-cell label">{formatFieldName(field)}</div>
                    <div className="comparison-cell" style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12,
                      color: 'var(--text-primary)',
                    }}>{raw || '-'}</div>
                    <div className={`comparison-cell ${changed ? 'changed' : ''}`}
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                        fontWeight: changed ? 600 : 400,
                      }}>
                      {std || '-'}
                    </div>
                    <div className="comparison-cell" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {changes.length > 0 ? changes.map((c, ci) => (
                        <span key={ci} style={{
                          fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-sans, system-ui)',
                          padding: '2px 8px', borderRadius: 3,
                          background: 'rgba(59,130,246,0.1)', color: 'var(--accent-light)',
                          letterSpacing: '0.02em', whiteSpace: 'nowrap',
                        }}>{c}</span>
                      )) : (
                        <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.4)' }}>—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import CleaningStandardization_TabView from './CleaningStandardization_TabView'
import DataQualityReportingView from './DataQualityReportingView'
import { api } from '../api'
import {
  SOURCE_SYSTEMS,
  SOURCE_SYSTEM_LABELS,
  normalizeSourceSystem,
  readSelectedSourceSystem,
  writeSelectedSourceSystem,
} from '../sourceSystem'
import {
  SOURCE_TYPE_DEFINITIONS,
  getConnectorsForSourceType,
  getSavedConnectionsFor,
} from '../data/sourceConnections'
import { THIRD_PARTY_VENDOR_REGISTRY } from '../data/thirdPartyVendors'

const API_BASE = ""

/* ── Source system filter ─────────────────────────────────────────────────
   The dropdown is stored in localStorage so other pages can read it
   consistently. Source system is derived from the filename prefix; the prefix
   itself is hidden from the UI display name. */
const SOURCE_SYSTEM_OPTIONS = [
  { value: 'media', label: SOURCE_SYSTEM_LABELS.media },
  { value: 'sports', label: SOURCE_SYSTEM_LABELS.sports },
  { value: 'telecom', label: SOURCE_SYSTEM_LABELS.telecom },
  { value: 'automotive', label: SOURCE_SYSTEM_LABELS.automotive },
]

function normalizeSourceSystemValue(value, fallback = 'media') {
  return normalizeSourceSystem(value, fallback)
}

function readStoredSourceSystem() {
  return readSelectedSourceSystem()
}

function writeStoredSourceSystem(sourceSystem) {
  return writeSelectedSourceSystem(sourceSystem)
}

function getSourceSystem(sourceName) {
  const basename = (sourceName || '').split('/').pop()
  if (basename.startsWith('med_')) return 'media'
  if (basename.startsWith('spt_')) return 'sports'
  if (basename.startsWith('tel_')) return 'telecom'
  if (basename.startsWith('aut_')) return 'automotive'
  return 'junk'
}

function cleanDisplayName(displayName) {
  if (!displayName) return displayName
  return displayName.replace(/^(Med|Spt|Tel|Aut|Auto)\s+/i, '')
}

function sourceBasename(name) {
  return String(name || '').split(/[\\/]/).pop()
}

function getSourceTagMapping(tagMappings, sourceName) {
  if (!tagMappings) return null
  return tagMappings[sourceName] || tagMappings[sourceBasename(sourceName)] || null
}

function getClassificationForSource(classification, source) {
  return classification[source.name] || classification[sourceBasename(source.name)] || {}
}

function getSourceSystemPrefix(sourceSystem) {
  if (sourceSystem === 'media') return 'med'
  if (sourceSystem === 'sports') return 'spt'
  if (sourceSystem === 'telecom') return 'tel'
  if (sourceSystem === 'automotive') return 'aut'
  return ''
}

function inferThirdPartyVendorTable(tableName, vendors) {
  const lower = String(tableName || '').toLowerCase()
  return vendors.find(vendor => (vendor.tableMatchers || []).some(pattern => lower.includes(pattern))) || null
}

function inferThirdPartyTableCategory(tableName) {
  const lower = String(tableName || '').toLowerCase()
  if (lower.includes('demographic')) return 'Demographics'
  if (lower.includes('affinity')) return 'Affinity'
  if (lower.includes('audience')) return 'Audience'
  if (lower.includes('household')) return 'Household'
  if (lower.includes('visit')) return 'Location Signals'
  if (lower.includes('viewing')) return 'Viewing'
  return 'Enrichment'
}

function inferThirdPartyFallbackTableCategory(tableName) {
  return inferThirdPartyTableCategory(tableName)
}

const THIRD_PARTY_DATABRICKS_LOCATION = {
  sports: { catalog: 'cmegtmdev', schema: 'marketing_sources' },
  media: { catalog: 'cmegtmdev', schema: 'marketing_sources' },
  telecom: { catalog: 'cmegtmdev', schema: 'marketing_sources' },
  automotive: { catalog: 'cmegtmdev', schema: 'marketing_sources' },
}

/* ── Party badge ─────────────────────────────────────────────────────────── */
const PARTY_STYLES = {
  '1P': { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: '1st Party' },
  '2P': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: '2nd Party' },
  '3P': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: '3rd Party' },
  'ML': { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', label: 'ML · ML Enrichment' },
}

function PartyBadge({ party }) {
  const s = PARTY_STYLES[party] || { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', label: party || '?' }
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function UsageBadge({ useForIdentity }) {
  return useForIdentity
    ? <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 9999 }}>✓ Identity</span>
    : <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 9999 }}>Enrichment Only</span>
}

function ExpandableTags({ tags }) {
  const [expanded, setExpanded] = useState(false)
  if (!tags || tags.length === 0) return null
  const visible = expanded ? tags : tags.slice(0, 5)
  const remaining = tags.length - 5
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {visible.map(tag => <span key={tag} className="tag-chip">{tag}</span>)}
      {remaining > 0 && !expanded && (
        <span className="tag-chip" style={{ cursor: 'pointer', opacity: 0.8, background: 'rgba(0,102,204,0.25)' }}
          onClick={e => { e.stopPropagation(); setExpanded(true) }}>+{remaining} more</span>
      )}
      {expanded && remaining > 0 && (
        <span className="tag-chip" style={{ cursor: 'pointer', opacity: 0.6 }}
          onClick={e => { e.stopPropagation(); setExpanded(false) }}>show less</span>
      )}
    </div>
  )
}

function ScoreBadge({ score }) {
  const pct = Math.round(score * 100)
  const color = pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : pct >= 35 ? '#ef4444' : '#6b7280'
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: `${color}22`, color, minWidth: 42, textAlign: 'center' }}>
      {pct}%
    </span>
  )
}

/* ── Source Type Picker Modal ────────────────────────────────────────────── */
const SOURCE_ICONS = {
  file: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  warehouse: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  database: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
  api: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  cloud: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  crm: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  streaming: 'M13 10V3L4 14h7v7l9-11h-7z',
  manual: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
}
const SOURCE_TYPE_COLORS = {
  file: '#3b82f6', warehouse: '#8b5cf6', database: '#06b6d4', api: '#f59e0b',
  cloud: '#6366f1', crm: '#ec4899', streaming: '#10b981', manual: '#64748b',
}
function SourceTypeIcon({ id, size = 20 }) {
  const color = SOURCE_TYPE_COLORS[id] || '#64748b'
  return (
    <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={SOURCE_ICONS[id]} />
      </svg>
    </div>
  )
}

function SourceTypePicker({ onSelect, onClose }) {
  const [hovered, setHovered] = useState(null)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, width: 680, maxWidth: '92vw', boxShadow: '0 32px 64px rgba(0,0,0,0.4)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>Add Data Source</h3>
              <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Select a connector to ingest data into the identity resolution pipeline</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div style={{ padding: '20px 24px 0' }}>
          {SOURCE_TYPE_DEFINITIONS.filter(st => st.ready).map(st => {
            const color = SOURCE_TYPE_COLORS[st.id]
            const isHovered = hovered === st.id
            return (
              <div key={st.id} onClick={() => onSelect(st.id)} onMouseEnter={() => setHovered(st.id)} onMouseLeave={() => setHovered(null)}
                style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${isHovered ? color : 'var(--border)'}`, background: isHovered ? `${color}0a` : 'var(--bg-primary)', cursor: 'pointer', transition: 'all 0.18s', display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <SourceTypeIcon id={st.id} size={16} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{st.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{st.desc}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isHovered ? color : 'var(--accent-light)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '16px 24px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Coming Soon</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {SOURCE_TYPE_DEFINITIONS.filter(st => !st.ready).map(st => (
              <div key={st.id} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', opacity: 0.65 }}>
                <SourceTypeIcon id={st.id} size={16} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{st.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{st.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Additional connectors available upon request</span>
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12.5 }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function ConnectorPickerModal({ sourceType, onClose, onBack, onSelect }) {
  const connectors = getConnectorsForSourceType(sourceType)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, width: 720, maxWidth: '94vw', boxShadow: '0 32px 64px rgba(0,0,0,0.35)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>Select Connector</h3>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Choose the connector you want to use for this source type.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={onBack} style={{ fontSize: 12, padding: '6px 10px' }}>Back</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>×</button>
          </div>
        </div>
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {connectors.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => item.supportsIngest && onSelect(item)}
              disabled={!item.supportsIngest}
              style={{
                textAlign: 'left',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 18px',
                background: item.supportsIngest ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                cursor: item.supportsIngest ? 'pointer' : 'not-allowed',
                opacity: item.supportsIngest ? 1 : 0.65,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                {item.supportsIngest ? 'Ready to use with saved connections' : 'Scaffolded for later enablement'}
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function SavedConnectionPickerModal({ sourceType, connector, onClose, onBack, onSelect }) {
  const connections = getSavedConnectionsFor(sourceType, connector?.id)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, width: 700, maxWidth: '94vw', boxShadow: '0 32px 64px rgba(0,0,0,0.35)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>Select Saved Connection</h3>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Choose a saved {connector?.label} connection. Connection setup can move to Application Settings later without changing this ingest flow.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={onBack} style={{ fontSize: 12, padding: '6px 10px' }}>Back</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>×</button>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Connector</div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{connector?.label}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
              {connector?.supportsIngest ? 'Ready for Add Source ingest flow' : 'Scaffolded for future implementation'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {connections.length === 0 && (
              <div style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13 }}>
                No saved connections defined for this connector yet. Add one later in the shared connection registry file or future Application Settings page.
              </div>
            )}
            {connections.map(item => (
              <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: item.configured ? 'var(--text-secondary)' : '#f59e0b', marginTop: 4 }}>
                    {item.configured ? 'Configured and ready to use' : item.description}
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onSelect({ connector, connection: item })}
                  disabled={!connector?.supportsIngest || !item.configured}
                >
                  Use Connection
                </button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ── Upload Modal ────────────────────────────────────────────────────────── */
function UploadModal({ onClose, onUploaded }) {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.csv')) { setError('Only .csv files are supported'); return }
    setUploading(true); setError(null)
    try { const result = await api.uploadSource(file); onUploaded(result) }
    catch (e) { setError(e.message) }
    setUploading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 32, width: 480, maxWidth: '90vw', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Add Source Data</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 13 }}>Upload a CSV file to add as a new data source.</p>
        <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(0,102,204,0.05)' : 'transparent' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{uploading ? 'Uploading...' : 'Drop CSV file here or click to browse'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Supports .csv files</div>
        </div>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
        {error && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function DatabricksModal({ onClose, onBack, onIngested, sourceSystem, savedConnection }) {
  const [form, setForm] = useState({
    catalog: '',
    schema: '',
  })
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)
  const [loadingSchemas, setLoadingSchemas] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [catalogs, setCatalogs] = useState([])
  const [schemas, setSchemas] = useState([])
  const [tables, setTables] = useState([])
  const [selectedTables, setSelectedTables] = useState([])
  const [selectedTableNames, setSelectedTableNames] = useState({})
  const [activePreviewTable, setActivePreviewTable] = useState('')
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const connectionPayload = {
    connection_mode: savedConnection?.config?.connection_mode || '',
    server_hostname: savedConnection?.config?.server_hostname || '',
    http_path: savedConnection?.config?.http_path || '',
    pat_token: savedConnection?.config?.pat_token || '',
  }

  const runtimeManaged = connectionPayload.connection_mode === 'runtime'
  const canLoadConnection = runtimeManaged || (
    connectionPayload.server_hostname
    && connectionPayload.http_path
    && connectionPayload.pat_token
  )

  const maskHostname = (value) => {
    if (!value) return 'Not configured'
    const [firstSegment, ...rest] = String(value).split('.')
    if (!firstSegment || rest.length === 0) return value
    const visiblePrefix = firstSegment.slice(0, 8)
    return `${visiblePrefix}xxxx.${rest.join('.')}`
  }

  const handleLoadCatalogs = async () => {
    if (!canLoadConnection) {
      setError('This saved connection is incomplete. Configure it through the server-side runtime settings.')
      return
    }
    setLoadingCatalogs(true)
    setError('')
    setMessage('')
    setPreview(null)
    try {
      const result = await api.databricksCatalogs(connectionPayload)
      const nextCatalogs = result.catalogs || []
      setCatalogs(nextCatalogs)
      setSchemas([])
      setTables([])
      setSelectedTables([])
      setSelectedTableNames({})
      setActivePreviewTable('')
      setForm(prev => ({
        ...prev,
        catalog: '',
        schema: '',
      }))
      setMessage(nextCatalogs.length > 0 ? 'Connection loaded. Select a catalog to continue.' : 'Connection loaded, but no catalogs were returned.')
    } catch (e) {
      setError(e.message)
    }
    setLoadingCatalogs(false)
  }

  useEffect(() => {
    handleLoadCatalogs()
  }, [])

  const handleLoadSchemas = async (catalogValue) => {
    if (!catalogValue) return
    setLoadingSchemas(true)
    setError('')
    setPreview(null)
    try {
      const result = await api.databricksSchemas({ ...connectionPayload, catalog: catalogValue })
      const nextSchemas = result.schemas || []
      setSchemas(nextSchemas)
      setTables([])
      setSelectedTables([])
      setSelectedTableNames({})
      setActivePreviewTable('')
      setForm(prev => ({
        ...prev,
        catalog: catalogValue,
        schema: '',
      }))
    } catch (e) {
      setError(e.message)
    }
    setLoadingSchemas(false)
  }

  const handleLoadTables = async (catalogValue, schemaValue) => {
    if (!catalogValue || !schemaValue) return
    setLoadingTables(true)
    setError('')
    setPreview(null)
    try {
      const result = await api.databricksTables({
        ...connectionPayload,
        catalog: catalogValue,
        schema: schemaValue,
      })
      const nextTables = result.tables || []
      setTables(nextTables)
      setSelectedTables([])
      setSelectedTableNames({})
      setActivePreviewTable('')
    } catch (e) {
      setError(e.message)
    }
    setLoadingTables(false)
  }

  const toggleTableSelection = (tableName) => {
    setError('')
    setPreview(null)
    setSelectedTables(prev => {
      if (prev.includes(tableName)) {
        const next = prev.filter(name => name !== tableName)
        setSelectedTableNames(names => {
          const updated = { ...names }
          delete updated[tableName]
          return updated
        })
        if (activePreviewTable === tableName) {
          setActivePreviewTable(next[0] || '')
        }
        return next
      }
      const next = [...prev, tableName]
      setSelectedTableNames(names => ({
        ...names,
        [tableName]: names[tableName] || '',
      }))
      if (!activePreviewTable) {
        setActivePreviewTable(tableName)
      }
      return next
    })
  }

  const updateSelectedTableName = (tableName, value) => {
    setSelectedTableNames(prev => ({
      ...prev,
      [tableName]: value,
    }))
  }

  const handlePreviewTableSelect = (tableName) => {
    setActivePreviewTable(tableName)
    setPreview(null)
    setError('')
  }

  const handlePreview = async () => {
    if (!form.catalog || !form.schema || !activePreviewTable) {
      setError('Catalog, schema, and a selected preview table are required for preview.')
      return
    }
    setPreviewing(true)
    setError('')
    try {
      const result = await api.databricksPreview({
        ...connectionPayload,
        catalog: form.catalog,
        schema: form.schema,
        table: activePreviewTable,
        limit: 10,
      })
      setPreview(result)
    } catch (e) {
      setError(e.message)
    }
    setPreviewing(false)
  }

  const handleIngest = async () => {
    if (!form.catalog || !form.schema || selectedTables.length === 0) {
      setError('Catalog, schema, and at least one selected table are required for ingest.')
      return
    }
    setIngesting(true)
    setError('')
    try {
      const results = []
      for (const tableName of selectedTables) {
        const result = await api.databricksIngest({
          ...connectionPayload,
          catalog: form.catalog,
          schema: form.schema,
          table: tableName,
          source_name: (selectedTableNames[tableName] || '').trim(),
          source_system: sourceSystem,
        })
        results.push(result)
      }
      onIngested(results)
    } catch (e) {
      setError(e.message)
    }
    setIngesting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, width: 760, maxWidth: '95vw', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.35)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>Databricks Connector</h3>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Use a saved Databricks connection to select catalog/schema/table, preview rows, and ingest into Data Overview.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={onBack} style={{ fontSize: 12, padding: '6px 10px' }}>Back</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>×</button>
          </div>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saved Connection</div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{savedConnection?.label}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{savedConnection?.description || 'Connection details loaded from the shared connection registry file.'}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              Host: <strong style={{ color: 'var(--text-primary)' }}>{runtimeManaged ? 'Databricks App workspace' : maskHostname(connectionPayload.server_hostname)}</strong>
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
              Authentication: <strong style={{ color: 'var(--text-primary)' }}>{runtimeManaged ? 'App service principal' : connectionPayload.pat_token ? 'PAT configured' : 'PAT missing'}</strong>
            </div>
          </div>
          <div style={{ marginBottom: 18, fontSize: 12, color: error ? '#dc2626' : message ? '#10b981' : 'var(--text-muted)' }}>
            {error || message || (loadingCatalogs ? 'Loading catalogs from saved connection...' : 'Select a catalog to begin browsing tables.')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              Catalog
              <select
                value={form.catalog}
                onChange={async e => {
                  const value = e.target.value
                  setForm(prev => ({ ...prev, catalog: value, schema: '' }))
                  setSchemas([])
                  setTables([])
                  setSelectedTables([])
                  setActivePreviewTable('')
                  if (value) await handleLoadSchemas(value)
                }}
                disabled={loadingCatalogs || catalogs.length === 0}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                <option value="">{loadingCatalogs ? 'Loading catalogs...' : 'Select catalog'}</option>
                {catalogs.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              Schema
              <select
                value={form.schema}
                onChange={async e => {
                  const value = e.target.value
                  setForm(prev => ({ ...prev, schema: value }))
                  setTables([])
                  setSelectedTables([])
                  setActivePreviewTable('')
                  if (form.catalog && value) await handleLoadTables(form.catalog, value)
                }}
                disabled={!form.catalog || loadingSchemas}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                <option value="">{loadingSchemas ? 'Loading schemas...' : 'Select schema'}</option>
                {schemas.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              Table Selection
              <div style={{ minHeight: 42, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                {loadingTables ? 'Loading tables...' : `${selectedTables.length} table(s) selected`}
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            The selected source system is <strong style={{ color: 'var(--text-primary)' }}>{sourceSystem}</strong>. Ingested files will follow the existing prefix contract for that system.
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <span className="card-title">Available Tables</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tables.length} loaded</span>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tables.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Load a schema to view tables.</span>}
              {tables.map(item => {
                const selected = selectedTables.includes(item.name)
                return (
                  <label
                    key={item.name}
                    style={{
                      border: selected ? '1px solid #2563eb' : '1px solid var(--border)',
                      background: selected ? 'rgba(37,99,235,0.08)' : 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderRadius: 10,
                      padding: '9px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleTableSelection(item.name)}
                        style={{ width: 12, height: 12, cursor: 'pointer' }}
                      />
                      <span>{item.name}</span>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.type}</span>
                  </label>
                )
              })}
            </div>
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <span className="card-title">Selected Tables And Source Names</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Preview or rename each selected table before ingest</span>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedTables.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tables selected</span>}
              {selectedTables.map(tableName => {
                const active = activePreviewTable === tableName
                return (
                  <div key={tableName} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 120px', gap: 10, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handlePreviewTableSelect(tableName)}
                      style={{
                        border: active ? '1px solid #10b981' : '1px solid var(--border)',
                        background: active ? 'rgba(16,185,129,0.12)' : 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        borderRadius: 8,
                        padding: '9px 10px',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                    >
                      {active ? 'Previewing: ' : ''}{tableName}
                    </button>
                    <input
                      value={selectedTableNames[tableName] || ''}
                      onChange={e => updateSelectedTableName(tableName, e.target.value)}
                      placeholder={`Optional source name for ${tableName}`}
                      style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Saved with {sourceSystem} prefix
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="btn btn-secondary" onClick={handleLoadCatalogs} disabled={loadingCatalogs}>{loadingCatalogs ? 'Refreshing...' : 'Refresh Metadata'}</button>
            <button className="btn btn-secondary" onClick={handlePreview} disabled={previewing || !activePreviewTable}>{previewing ? 'Loading Preview...' : 'Preview Selected Table'}</button>
            <button className="btn btn-primary" onClick={handleIngest} disabled={ingesting || selectedTables.length === 0}>{ingesting ? 'Ingesting...' : `Ingest ${selectedTables.length || ''} Selected Table${selectedTables.length === 1 ? '' : 's'}`}</button>
          </div>
          {preview && (
            <div className="card" style={{ marginTop: 8 }}>
              <div className="card-header">
                <span className="card-title">Preview: {form.catalog}.{form.schema}.{activePreviewTable}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{preview.rows?.length || 0} rows</span>
              </div>
              <div className="data-table-wrapper" style={{ maxHeight: 320 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {(preview.columns || []).map(col => <th key={col}>{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.rows || []).map((row, idx) => (
                      <tr key={idx}>
                        {(preview.columns || []).map(col => <td key={`${idx}-${col}`}>{String(row[col] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ── Auto-Tag Review Panel ───────────────────────────────────────────────── */
function AutoTagPanel({ source, tagResults, onAccept, onCancel, saving }) {
  const [edits, setEdits] = useState(() => {
    const m = {}
    if (tagResults?.columns) Object.entries(tagResults.columns).forEach(([col, info]) => { m[col] = info.tag || '' })
    return m
  })
  return (
    <div className="card" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
      <div className="card-header">
        <span className="card-title">Auto-Tag Results: <code style={{ fontSize: 13 }}>{source}</code></span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Threshold: {Math.round(tagResults.threshold * 100)}% · Vocab: {tagResults.vocabulary_size}</span>
      </div>
      <div className="data-table-wrapper" style={{ maxHeight: 400, overflow: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Source Column</th><th style={{ width: 80 }}>Similarity</th><th>Canonical Tag</th><th style={{ width: 70 }}>Status</th></tr></thead>
          <tbody>
            {Object.entries(tagResults.columns).map(([col, info]) => {
              const currentTag = edits[col] || ''
              const isUntagged = !currentTag
              const isEdited = currentTag !== (info.tag || '')
              return (
                <tr key={col} style={{ background: isUntagged ? 'rgba(239,68,68,0.05)' : undefined }}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{col}</td>
                  <td><ScoreBadge score={info.score} /></td>
                  <td>
                    <input type="text" value={currentTag} onChange={e => setEdits(p => ({ ...p, [col]: e.target.value }))} placeholder="untagged"
                      style={{ width: '100%', padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {isEdited ? <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>edited</span>
                      : isUntagged ? <span style={{ fontSize: 11, color: '#ef4444' }}>low</span>
                        : <span style={{ fontSize: 11, color: '#22c55e' }}>auto</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onAccept(edits)} disabled={saving}>{saving ? 'Saving...' : 'Accept & Save Tags'}</button>
      </div>
    </div>
  )
}

function DatabaseConnectorModal({ onClose, onBack, onIngested, sourceSystem, savedConnection, connectorId, connectorLabel }) {
  const [schema, setSchema] = useState('')
  const [schemas, setSchemas] = useState([])
  const [tables, setTables] = useState([])
  const [selectedTables, setSelectedTables] = useState([])
  const [selectedTableNames, setSelectedTableNames] = useState({})
  const [activePreviewTable, setActivePreviewTable] = useState('')
  const [loadingSchemas, setLoadingSchemas] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const payload = savedConnection?.config || {}

  const maskValue = (value) => {
    if (!value) return 'Not configured'
    const text = String(value)
    if (text.length <= 10) return `${text.slice(0, 3)}xxx`
    return `${text.slice(0, 6)}xxxx${text.slice(-4)}`
  }

  const handleLoadSchemas = async () => {
    setLoadingSchemas(true)
    setError('')
    setMessage('')
    try {
      const result = await api.connectorSchemas(connectorId, payload)
      setSchemas(result.schemas || [])
      setSchema('')
      setTables([])
      setSelectedTables([])
      setSelectedTableNames({})
      setActivePreviewTable('')
      setMessage('Connection loaded. Select a schema to continue.')
    } catch (e) {
      setError(e.message)
    }
    setLoadingSchemas(false)
  }

  useEffect(() => {
    handleLoadSchemas()
  }, [])

  const handleLoadTables = async (schemaValue) => {
    if (!schemaValue) return
    setLoadingTables(true)
    setError('')
    setPreview(null)
    try {
      const result = await api.connectorTables(connectorId, { ...payload, schema: schemaValue })
      setTables(result.tables || [])
      setSelectedTables([])
      setSelectedTableNames({})
      setActivePreviewTable('')
    } catch (e) {
      setError(e.message)
    }
    setLoadingTables(false)
  }

  const toggleTableSelection = (tableName) => {
    setSelectedTables(prev => {
      if (prev.includes(tableName)) {
        const next = prev.filter(name => name !== tableName)
        setSelectedTableNames(names => {
          const updated = { ...names }
          delete updated[tableName]
          return updated
        })
        if (activePreviewTable === tableName) setActivePreviewTable(next[0] || '')
        return next
      }
      const next = [...prev, tableName]
      setSelectedTableNames(names => ({ ...names, [tableName]: names[tableName] || '' }))
      if (!activePreviewTable) setActivePreviewTable(tableName)
      return next
    })
    setPreview(null)
    setError('')
  }

  const updateSelectedTableName = (tableName, value) => setSelectedTableNames(prev => ({ ...prev, [tableName]: value }))

  const handlePreview = async () => {
    if (!schema || !activePreviewTable) {
      setError('Select a schema and one preview table first.')
      return
    }
    setPreviewing(true)
    setError('')
    try {
      const result = await api.connectorPreview(connectorId, { ...payload, schema, table: activePreviewTable, limit: 10 })
      setPreview(result)
    } catch (e) {
      setError(e.message)
    }
    setPreviewing(false)
  }

  const handleIngest = async () => {
    if (!schema || selectedTables.length === 0) {
      setError('Select at least one table to ingest.')
      return
    }
    setIngesting(true)
    setError('')
    try {
      const results = []
      for (const tableName of selectedTables) {
        results.push(await api.connectorIngest(connectorId, {
          ...payload,
          schema,
          table: tableName,
          source_name: (selectedTableNames[tableName] || '').trim(),
          source_system: sourceSystem,
        }))
      }
      onIngested(results)
    } catch (e) {
      setError(e.message)
    }
    setIngesting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, width: 760, maxWidth: '95vw', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.35)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>{connectorLabel}</h3>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Use a saved {connectorLabel} connection to select schema and tables, preview rows, and ingest into Data Overview.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={onBack} style={{ fontSize: 12, padding: '6px 10px' }}>Back</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>×</button>
          </div>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saved Connection</div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{savedConnection?.label}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{savedConnection?.description}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Host: <strong style={{ color: 'var(--text-primary)' }}>{maskValue(payload.host)}</strong></div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Database: <strong style={{ color: 'var(--text-primary)' }}>{payload.database || 'Not configured'}</strong></div>
          </div>
          <div style={{ marginBottom: 18, fontSize: 12, color: error ? '#dc2626' : message ? '#10b981' : 'var(--text-muted)' }}>{error || message || (loadingSchemas ? 'Loading schemas from saved connection...' : 'Select a schema to begin browsing tables.')}</div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Schema
            <select value={schema} onChange={async e => { const value = e.target.value; setSchema(value); setTables([]); setSelectedTables([]); setSelectedTableNames({}); setActivePreviewTable(''); if (value) await handleLoadTables(value) }} disabled={schemas.length === 0 || loadingSchemas} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
              <option value="">{loadingSchemas ? 'Loading schemas...' : 'Select schema'}</option>
              {schemas.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>The selected source system is <strong style={{ color: 'var(--text-primary)' }}>{sourceSystem}</strong>.</div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header"><span className="card-title">Available Tables</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tables.length} loaded</span></div>
            <div style={{ maxHeight: 220, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tables.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Load a schema to view tables.</span>}
              {tables.map(item => {
                const selected = selectedTables.includes(item.name)
                return <label key={item.name} style={{ border: selected ? '1px solid #2563eb' : '1px solid var(--border)', background: selected ? 'rgba(37,99,235,0.08)' : 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: 10, padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={selected} onChange={() => toggleTableSelection(item.name)} style={{ width: 12, height: 12, cursor: 'pointer' }} />
                    <span>{item.name}</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.type}</span>
                </label>
              })}
            </div>
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header"><span className="card-title">Selected Tables And Source Names</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Preview or rename each selected table before ingest</span></div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedTables.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tables selected</span>}
              {selectedTables.map(tableName => <div key={tableName} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 120px', gap: 10, alignItems: 'center' }}>
                <button type="button" onClick={() => { setActivePreviewTable(tableName); setPreview(null); setError('') }} style={{ border: activePreviewTable === tableName ? '1px solid #10b981' : '1px solid var(--border)', background: activePreviewTable === tableName ? 'rgba(16,185,129,0.12)' : 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: 8, padding: '9px 10px', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>{activePreviewTable === tableName ? 'Previewing: ' : ''}{tableName}</button>
                <input value={selectedTableNames[tableName] || ''} onChange={e => updateSelectedTableName(tableName, e.target.value)} placeholder={`Optional source name for ${tableName}`} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saved with {sourceSystem} prefix</div>
              </div>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="btn btn-secondary" onClick={handleLoadSchemas} disabled={loadingSchemas}>{loadingSchemas ? 'Refreshing...' : 'Refresh Metadata'}</button>
            <button className="btn btn-secondary" onClick={handlePreview} disabled={previewing || !activePreviewTable}>{previewing ? 'Loading Preview...' : 'Preview Selected Table'}</button>
            <button className="btn btn-primary" onClick={handleIngest} disabled={ingesting || selectedTables.length === 0}>{ingesting ? 'Ingesting...' : `Ingest ${selectedTables.length || ''} Selected Table${selectedTables.length === 1 ? '' : 's'}`}</button>
          </div>
          {preview && <div className="card" style={{ marginTop: 8 }}>
            <div className="card-header"><span className="card-title">Preview: {schema}.{activePreviewTable}</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{preview.rows?.length || 0} rows</span></div>
            <div className="data-table-wrapper" style={{ maxHeight: 320 }}>
              <table className="data-table"><thead><tr>{(preview.columns || []).map(col => <th key={col}>{col}</th>)}</tr></thead><tbody>{(preview.rows || []).map((row, idx) => <tr key={idx}>{(preview.columns || []).map(col => <td key={`${idx}-${col}`}>{String(row[col] ?? '')}</td>)}</tr>)}</tbody></table>
            </div>
          </div>}
        </div>
        <div style={{ padding: '16px 24px 20px', display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

function ApiConnectorModal({ onClose, onBack, onIngested, sourceSystem, savedConnection }) {
  const connectorId = 'rest_api'
  const payload = savedConnection?.config || {}
  const [endpoints, setEndpoints] = useState([])
  const [selectedEndpoints, setSelectedEndpoints] = useState([])
  const [selectedNames, setSelectedNames] = useState({})
  const [activePreviewEndpoint, setActivePreviewEndpoint] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [ingesting, setIngesting] = useState(false)

  const maskUrl = (value) => {
    if (!value) return 'Not configured'
    try {
      const url = new URL(value)
      return `${url.protocol}//${url.hostname.slice(0, 8)}xxxx${url.port ? `:${url.port}` : ''}`
    } catch {
      return `${String(value).slice(0, 12)}xxxx`
    }
  }

  const handleLoadEndpoints = async () => {
    setError('')
    setMessage('')
    try {
      const result = await api.connectorEndpoints(connectorId, payload)
      setEndpoints(result.endpoints || [])
      setSelectedEndpoints([])
      setSelectedNames({})
      setActivePreviewEndpoint('')
      setMessage('Connection loaded. Select endpoints to continue.')
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    handleLoadEndpoints()
  }, [])

  const toggleEndpoint = (endpoint) => {
    setSelectedEndpoints(prev => {
      if (prev.includes(endpoint)) {
        const next = prev.filter(item => item !== endpoint)
        setSelectedNames(names => {
          const updated = { ...names }
          delete updated[endpoint]
          return updated
        })
        if (activePreviewEndpoint === endpoint) setActivePreviewEndpoint(next[0] || '')
        return next
      }
      const next = [...prev, endpoint]
      setSelectedNames(names => ({ ...names, [endpoint]: names[endpoint] || '' }))
      if (!activePreviewEndpoint) setActivePreviewEndpoint(endpoint)
      return next
    })
    setPreview(null)
    setError('')
  }

  const handlePreview = async () => {
    if (!activePreviewEndpoint) {
      setError('Select one endpoint to preview.')
      return
    }
    setPreviewing(true)
    setError('')
    try {
      setPreview(await api.connectorPreview(connectorId, { ...payload, endpoint: activePreviewEndpoint, limit: 10 }))
    } catch (e) {
      setError(e.message)
    }
    setPreviewing(false)
  }

  const handleIngest = async () => {
    if (selectedEndpoints.length === 0) {
      setError('Select at least one endpoint to ingest.')
      return
    }
    setIngesting(true)
    setError('')
    try {
      const results = []
      for (const endpoint of selectedEndpoints) {
        results.push(await api.connectorIngest(connectorId, { ...payload, endpoint, source_name: (selectedNames[endpoint] || '').trim(), source_system: sourceSystem }))
      }
      onIngested(results)
    } catch (e) {
      setError(e.message)
    }
    setIngesting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, width: 760, maxWidth: '95vw', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.35)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>REST API</h3><p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Use a saved REST API connection to select endpoints, preview data, and ingest into Data Overview.</p></div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button className="btn btn-secondary" onClick={onBack} style={{ fontSize: 12, padding: '6px 10px' }}>Back</button><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>×</button></div></div>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saved Connection</div><div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{savedConnection?.label}</div><div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{savedConnection?.description}</div><div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Base URL: <strong style={{ color: 'var(--text-primary)' }}>{maskUrl(payload.base_url)}</strong></div><div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>Authentication: <strong style={{ color: 'var(--text-primary)' }}>{payload.auth_type || 'none'}</strong></div></div>
          <div style={{ marginBottom: 18, fontSize: 12, color: error ? '#dc2626' : message ? '#10b981' : 'var(--text-muted)' }}>{error || message || 'Select endpoints to continue.'}</div>
          <div className="card" style={{ marginBottom: 14 }}><div className="card-header"><span className="card-title">Available Endpoints</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{endpoints.length} configured</span></div><div style={{ maxHeight: 220, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>{endpoints.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add endpoint paths in the saved connection config.</span>}{endpoints.map(endpoint => { const selected = selectedEndpoints.includes(endpoint); return <label key={endpoint} style={{ border: selected ? '1px solid #2563eb' : '1px solid var(--border)', background: selected ? 'rgba(37,99,235,0.08)' : 'var(--bg-primary)', borderRadius: 10, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={selected} onChange={() => toggleEndpoint(endpoint)} style={{ width: 12, height: 12 }} /><span>{endpoint}</span></label>})}</div></div>
          <div className="card" style={{ marginBottom: 14 }}><div className="card-header"><span className="card-title">Selected Endpoints And Source Names</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Preview or rename each selected endpoint before ingest</span></div><div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>{selectedEndpoints.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No endpoints selected</span>}{selectedEndpoints.map(endpoint => <div key={endpoint} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 120px', gap: 10, alignItems: 'center' }}><button type="button" onClick={() => { setActivePreviewEndpoint(endpoint); setPreview(null); setError('') }} style={{ border: activePreviewEndpoint === endpoint ? '1px solid #10b981' : '1px solid var(--border)', background: activePreviewEndpoint === endpoint ? 'rgba(16,185,129,0.12)' : 'var(--bg-primary)', borderRadius: 8, padding: '9px 10px', textAlign: 'left' }}>{activePreviewEndpoint === endpoint ? 'Previewing: ' : ''}{endpoint}</button><input value={selectedNames[endpoint] || ''} onChange={e => setSelectedNames(prev => ({ ...prev, [endpoint]: e.target.value }))} placeholder={`Optional source name for ${endpoint}`} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} /><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saved with {sourceSystem} prefix</div></div>)}</div></div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}><button className="btn btn-secondary" onClick={handleLoadEndpoints}>Refresh Metadata</button><button className="btn btn-secondary" onClick={handlePreview} disabled={previewing || !activePreviewEndpoint}>{previewing ? 'Loading Preview...' : 'Preview Selected Endpoint'}</button><button className="btn btn-primary" onClick={handleIngest} disabled={ingesting || selectedEndpoints.length === 0}>{ingesting ? 'Ingesting...' : `Ingest ${selectedEndpoints.length || ''} Selected Endpoint${selectedEndpoints.length === 1 ? '' : 's'}`}</button></div>
          {preview && <div className="card" style={{ marginTop: 8 }}><div className="card-header"><span className="card-title">Preview: {activePreviewEndpoint}</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{preview.rows?.length || 0} rows</span></div><div className="data-table-wrapper" style={{ maxHeight: 320 }}><table className="data-table"><thead><tr>{(preview.columns || []).map(col => <th key={col}>{col}</th>)}</tr></thead><tbody>{(preview.rows || []).map((row, idx) => <tr key={idx}>{(preview.columns || []).map(col => <td key={`${idx}-${col}`}>{String(row[col] ?? '')}</td>)}</tr>)}</tbody></table></div></div>}
        </div>
        <div style={{ padding: '16px 24px 20px', display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

function ObjectStorageModal({ onClose, onBack, onIngested, sourceSystem, savedConnection, connectorId, connectorLabel }) {
  const payload = savedConnection?.config || {}
  const [prefix, setPrefix] = useState(payload.prefix || '')
  const [objects, setObjects] = useState([])
  const [selectedObjects, setSelectedObjects] = useState([])
  const [selectedNames, setSelectedNames] = useState({})
  const [activePreviewObject, setActivePreviewObject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [loadingObjects, setLoadingObjects] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [ingesting, setIngesting] = useState(false)

  const maskValue = (value) => value ? `${String(value).slice(0, 10)}xxxx` : 'Not configured'

  const handleLoadObjects = async () => {
    setLoadingObjects(true)
    setError('')
    setPreview(null)
    try {
      const result = await api.connectorObjects(connectorId, { ...payload, prefix })
      setObjects(result.objects || [])
      setSelectedObjects([])
      setSelectedNames({})
      setActivePreviewObject('')
    } catch (e) {
      setError(e.message)
    }
    setLoadingObjects(false)
  }

  useEffect(() => {
    handleLoadObjects()
  }, [])

  const toggleObject = (name) => {
    setSelectedObjects(prev => {
      if (prev.includes(name)) {
        const next = prev.filter(item => item !== name)
        setSelectedNames(names => {
          const updated = { ...names }
          delete updated[name]
          return updated
        })
        if (activePreviewObject === name) setActivePreviewObject(next[0] || '')
        return next
      }
      const next = [...prev, name]
      setSelectedNames(names => ({ ...names, [name]: names[name] || '' }))
      if (!activePreviewObject) setActivePreviewObject(name)
      return next
    })
    setPreview(null)
    setError('')
  }

  const handlePreview = async () => {
    if (!activePreviewObject) {
      setError('Select one object to preview.')
      return
    }
    setPreviewing(true)
    setError('')
    try {
      setPreview(await api.connectorPreview(connectorId, { ...payload, object_name: activePreviewObject, limit: 10 }))
    } catch (e) {
      setError(e.message)
    }
    setPreviewing(false)
  }

  const handleIngest = async () => {
    if (selectedObjects.length === 0) {
      setError('Select at least one object to ingest.')
      return
    }
    setIngesting(true)
    setError('')
    try {
      const results = []
      for (const objectName of selectedObjects) {
        results.push(await api.connectorIngest(connectorId, { ...payload, object_name: objectName, source_name: (selectedNames[objectName] || '').trim(), source_system: sourceSystem }))
      }
      onIngested(results)
    } catch (e) {
      setError(e.message)
    }
    setIngesting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, width: 760, maxWidth: '95vw', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.35)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>{connectorLabel}</h3><p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Use a saved {connectorLabel} connection to list files, preview content, and ingest into Data Overview.</p></div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button className="btn btn-secondary" onClick={onBack} style={{ fontSize: 12, padding: '6px 10px' }}>Back</button><button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>×</button></div></div>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saved Connection</div><div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{savedConnection?.label}</div><div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{savedConnection?.description}</div><div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{connectorId === 'azure_blob' ? 'Container' : 'Bucket'}: <strong style={{ color: 'var(--text-primary)' }}>{connectorId === 'azure_blob' ? (payload.container_name || 'Not configured') : (payload.bucket || 'Not configured')}</strong></div><div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{connectorId === 'azure_blob' ? 'Account' : 'Region'}: <strong style={{ color: 'var(--text-primary)' }}>{connectorId === 'azure_blob' ? maskValue(payload.account_url || payload.connection_string) : (payload.region || 'Not configured')}</strong></div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, marginBottom: 18, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>Prefix / Path<input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="Optional folder prefix" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} /></label>
            <button className="btn btn-primary" onClick={handleLoadObjects} disabled={loadingObjects}>{loadingObjects ? 'Loading...' : 'Load Objects'}</button>
          </div>
          <div style={{ marginBottom: 14, fontSize: 12, color: error ? '#dc2626' : message ? '#10b981' : 'var(--text-muted)' }}>{error || message || (loadingObjects ? 'Loading objects from saved connection...' : 'Browse objects and select what to ingest.')}</div>
          <div className="card" style={{ marginBottom: 14 }}><div className="card-header"><span className="card-title">Available Objects</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{objects.length} loaded</span></div><div style={{ maxHeight: 220, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>{objects.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Load objects to view files.</span>}{objects.map(item => { const selected = selectedObjects.includes(item.name); return <label key={item.name} style={{ border: selected ? '1px solid #2563eb' : '1px solid var(--border)', background: selected ? 'rgba(37,99,235,0.08)' : 'var(--bg-primary)', borderRadius: 10, padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={selected} onChange={() => toggleObject(item.name)} style={{ width: 12, height: 12 }} /><span>{item.name}</span></span><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.size || 0} bytes</span></label>})}</div></div>
          <div className="card" style={{ marginBottom: 14 }}><div className="card-header"><span className="card-title">Selected Objects And Source Names</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Preview or rename each selected object before ingest</span></div><div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>{selectedObjects.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No objects selected</span>}{selectedObjects.map(objectName => <div key={objectName} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 120px', gap: 10, alignItems: 'center' }}><button type="button" onClick={() => { setActivePreviewObject(objectName); setPreview(null); setError('') }} style={{ border: activePreviewObject === objectName ? '1px solid #10b981' : '1px solid var(--border)', background: activePreviewObject === objectName ? 'rgba(16,185,129,0.12)' : 'var(--bg-primary)', borderRadius: 8, padding: '9px 10px', textAlign: 'left' }}>{activePreviewObject === objectName ? 'Previewing: ' : ''}{objectName}</button><input value={selectedNames[objectName] || ''} onChange={e => setSelectedNames(prev => ({ ...prev, [objectName]: e.target.value }))} placeholder={`Optional source name for ${objectName}`} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} /><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saved with {sourceSystem} prefix</div></div>)}</div></div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}><button className="btn btn-secondary" onClick={handlePreview} disabled={previewing || !activePreviewObject}>{previewing ? 'Loading Preview...' : 'Preview Selected Object'}</button><button className="btn btn-primary" onClick={handleIngest} disabled={ingesting || selectedObjects.length === 0}>{ingesting ? 'Ingesting...' : `Ingest ${selectedObjects.length || ''} Selected Object${selectedObjects.length === 1 ? '' : 's'}`}</button></div>
          {preview && <div className="card" style={{ marginTop: 8 }}><div className="card-header"><span className="card-title">Preview: {activePreviewObject}</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{preview.rows?.length || 0} rows</span></div><div className="data-table-wrapper" style={{ maxHeight: 320 }}><table className="data-table"><thead><tr>{(preview.columns || []).map(col => <th key={col}>{col}</th>)}</tr></thead><tbody>{(preview.rows || []).map((row, idx) => <tr key={idx}>{(preview.columns || []).map(col => <td key={`${idx}-${col}`}>{String(row[col] ?? '')}</td>)}</tr>)}</tbody></table></div></div>}
        </div>
        <div style={{ padding: '16px 24px 20px', display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

/* ── Enrichment Connector Types ─────────────────────────────────────────── */
const ENRICHMENT_CONNECTORS = [
  { id: 'csv', label: 'CSV / File Upload', icon: '📄', ready: true, badge: null },
  { id: 'sftp', label: 'SFTP / Cloud Storage', icon: '☁️', ready: false, badge: 'Roadmap' },
  { id: 'api', label: 'REST API / Webhook', icon: '🔌', ready: false, badge: 'Roadmap' },
  { id: 'db', label: 'Database Direct', icon: '🗄️', ready: false, badge: 'Roadmap' },
  { id: 'crm', label: 'CRM / SaaS Platform', icon: '🏢', ready: false, badge: 'Roadmap' },
  { id: 'stream', label: 'Streaming / Events', icon: '⚡', ready: false, badge: 'Roadmap' },
  { id: 'ml', label: 'ML Model Output', icon: '🤖', ready: false, badge: 'Roadmap' },
  { id: 'marketplace', label: 'Data Marketplace', icon: '🌐', ready: false, badge: 'Roadmap' },
]
const CONNECTOR_COLORS = {
  csv: '#3b82f6', sftp: '#8b5cf6', api: '#f59e0b', db: '#06b6d4',
  crm: '#ec4899', stream: '#10b981', ml: '#a78bfa', marketplace: '#f97316',
}

function detectMatchKey(columns) {
  const cols = columns.map(c => c.toLowerCase())
  if (cols.includes('email') && !cols.some(c => c.includes('sha') || c.includes('hash'))) return { key: 'email', confidence: 'high', reason: 'email column found' }
  if (cols.some(c => c.includes('sha256') || c.includes('hash'))) return { key: 'email_sha256', confidence: 'high', reason: 'hashed email — privacy-safe 3P match' }
  if (cols.includes('device_id') || cols.some(c => c.includes('device'))) return { key: 'device_id', confidence: 'high', reason: 'device_id column found' }
  if (cols.includes('phone')) return { key: 'phone', confidence: 'high', reason: 'phone column found' }
  if (cols.includes('ip_address') || cols.includes('ip')) return { key: 'ip_address', confidence: 'medium', reason: 'IP address column found' }
  if (cols.includes('zip') && cols.some(c => c.includes('phone') || c.includes('prefix'))) return { key: 'zip+phone_prefix', confidence: 'medium', reason: 'zip + phone prefix found' }
  if (cols.includes('zip') && (cols.includes('first_name') || cols.includes('last_name') || cols.includes('full_name'))) return { key: 'zip+full_name', confidence: 'medium', reason: 'zip + name found' }
  if (cols.includes('zip')) return { key: 'zip+phone_prefix', confidence: 'low', reason: 'zip found — phone prefix match assumed' }
  return null
}

function readCsvHeaders(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const firstLine = e.target.result.split('\n')[0] || ''
      const headers = firstLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
      resolve(headers)
    }
    reader.readAsText(file.slice(0, 4096))
  })
}

/* ── Enrichment Source Modal ─────────────────────────────────────────────── */
function EnrichmentUploadModal({ onClose, onUploaded }) {
  const fileRef = useRef(null)
  const [step, setStep] = useState('connector')
  const [selectedConnector, setSelectedConnector] = useState(null)
  const [hoveredConnector, setHoveredConnector] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [party, setParty] = useState('3P')
  const [owner, setOwner] = useState('')
  const [matchKey, setMatchKey] = useState('')
  const [matchKeyOverride, setMatchKeyOverride] = useState(false)
  const [detectedKey, setDetectedKey] = useState(null)
  const [detectedColumns, setDetectedColumns] = useState([])
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [scanning, setScanning] = useState(false)

  const ALL_MATCH_KEYS = ['email', 'email_sha256', 'device_id', 'phone', 'ip_address', 'zip+phone_prefix', 'zip+full_name']
  const confidenceColor = { high: '#10b981', medium: '#f59e0b', low: '#f97316' }

  const handleFileSelect = async (file) => {
    if (!file || !file.name.endsWith('.csv')) { setError('Only .csv files are supported'); return }
    setSelectedFile(file); setScanning(true); setDetectedKey(null); setDetectedColumns([]); setMatchKeyOverride(false)
    try {
      const headers = await readCsvHeaders(file)
      setDetectedColumns(headers)
      const detected = detectMatchKey(headers)
      setDetectedKey(detected)
      if (detected) setMatchKey(detected.key)
    } catch { /* silent */ }
    setScanning(false)
  }

  const handleUpload = async () => {
    if (!selectedFile) { setError('Please select a CSV file'); return }
    if (!owner.trim()) { setError('Please enter a vendor / owner name'); return }
    if (!matchKey) { setError('Could not detect a match key — please select one manually'); return }
    setUploading(true); setError(null)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('party', party)
      formData.append('owner', owner)
      formData.append('match_key', matchKey)
      formData.append('description', description)
      const res = await fetch(`${API_BASE}/api/enrichment/upload`, { method: 'POST', body: formData })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Upload failed')
      onUploaded(result)
    } catch (e) { setError(e.message) }
    setUploading(false)
  }

  if (step === 'connector') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
        <div style={{ background: 'var(--bg-primary)', borderRadius: 16, width: 680, maxWidth: '94vw', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '24px 28px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>Add Enrichment Source</h3>
                <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Select a connector to ingest enrichment data for customer scoring.</p>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', padding: '20px 28px 24px', flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Available Now</div>
            {ENRICHMENT_CONNECTORS.filter(c => c.ready).map(c => {
              const color = CONNECTOR_COLORS[c.id] || '#64748b'
              const isHovered = hoveredConnector === c.id
              return (
                <div key={c.id} onClick={() => { setSelectedConnector(c); setStep('upload') }}
                  onMouseEnter={() => setHoveredConnector(c.id)} onMouseLeave={() => setHoveredConnector(null)}
                  style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '16px 18px', borderRadius: 12, border: `1.5px solid ${isHovered ? color : 'var(--accent)'}`, background: isHovered ? `${color}0d` : 'rgba(59,130,246,0.03)', cursor: 'pointer', transition: 'all 0.18s', marginBottom: 8 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{c.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.label}</div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isHovered ? color : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              )
            })}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '20px 0 10px' }}>Coming Soon</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ENRICHMENT_CONNECTORS.filter(c => !c.ready).map(c => {
                const color = CONNECTOR_COLORS[c.id] || '#64748b'
                return (
                  <div key={c.id} onClick={() => alert(`${c.label} connector is on the roadmap.`)}
                    style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 9, border: '1px solid var(--border)', opacity: 0.6, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{c.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{c.label}</div>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.badge}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 14, padding: 0, width: 540, maxWidth: '92vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setStep('connector')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 10px', fontSize: 12, fontFamily: 'inherit' }}>← Back</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedConnector?.icon} {selectedConnector?.label} — Enrichment Source</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Drop your file first — we'll auto-detect the match key from column names</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 24px 24px', flex: 1 }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Step 1 — Upload your CSV</div>
            <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files[0]) }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? 'var(--accent)' : selectedFile ? '#10b981' : 'var(--border)'}`, borderRadius: 10, padding: '18px', textAlign: 'center', cursor: 'pointer', background: selectedFile ? 'rgba(16,185,129,0.05)' : 'var(--bg-secondary)', transition: 'all 0.2s' }}>
              {scanning ? <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>🔍 Scanning columns...</div>
                : selectedFile
                  ? <div><div style={{ fontSize: 18, marginBottom: 3 }}>✅</div><div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>{selectedFile.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{(selectedFile.size / 1024).toFixed(0)} KB · {detectedColumns.length} columns · <span style={{ color: 'var(--accent-light)' }}>click to change</span></div></div>
                  : <div><div style={{ fontSize: 26, marginBottom: 5 }}>📄</div><div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Drop CSV file here or click to browse</div></div>
              }
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFileSelect(e.target.files[0])} />
          </div>
          {selectedFile && !scanning && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Step 2 — Match Key (auto-detected)</div>
              {detectedColumns.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>Columns detected:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {detectedColumns.slice(0, 12).map(col => (
                      <span key={col} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontFamily: 'monospace', border: '1px solid var(--border)' }}>{col}</span>
                    ))}
                    {detectedColumns.length > 12 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{detectedColumns.length - 12} more</span>}
                  </div>
                </div>
              )}
              {detectedKey && !matchKeyOverride
                ? <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{detectedKey.key}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 9999, background: `${confidenceColor[detectedKey.confidence]}20`, color: confidenceColor[detectedKey.confidence] }}>{detectedKey.confidence} confidence</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>✓ {detectedKey.reason}</div>
                  </div>
                  <button onClick={() => setMatchKeyOverride(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit' }}>Change</button>
                </div>
                : <div style={{ display: 'flex', gap: 6 }}>
                  {!detectedKey && <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 7, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#f59e0b', width: '100%' }}>⚠ Could not auto-detect match key — please select manually.</div>}
                  <select value={matchKey} onChange={e => setMatchKey(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }}>
                    <option value="">-- Select match key --</option>
                    {ALL_MATCH_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  {matchKeyOverride && detectedKey && (
                    <button onClick={() => { setMatchKeyOverride(false); setMatchKey(detectedKey.key) }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: '8px 10px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>↩ Use detected</button>
                  )}
                </div>
              }
            </div>
          )}
          {selectedFile && !scanning && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Step 3 — Source Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                {[
                  { value: '2P', icon: '🤝', label: 'Second Party', color: '#3b82f6', desc: 'Partner / clean room' },
                  { value: '3P', icon: '🌐', label: 'Third Party', color: '#f59e0b', desc: 'Vendor data' },
                  { value: 'ML', icon: '🤖', label: 'ML Enrichment', color: '#a78bfa', desc: 'Internal ML scoring' },
                ].map(p => (
                  <button key={p.value} onClick={() => setParty(p.value)}
                    style={{ padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', transition: 'all 0.15s', border: party === p.value ? 'none' : '1px solid var(--border)', background: party === p.value ? `${p.color}20` : 'var(--bg-secondary)', color: party === p.value ? p.color : 'var(--text-muted)', textAlign: 'center' }}>
                    <div>{p.icon} {p.label}</div>
                    <div style={{ fontSize: 9, marginTop: 2, opacity: 0.8 }}>{p.desc}</div>
                  </button>
                ))}
              </div>
              <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Vendor / owner name  e.g. SportsIQ, DataBridge"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description  e.g. Fan engagement scores from SportsIQ"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          )}
          {error && <div style={{ margin: '10px 0', padding: '8px 12px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', fontSize: 13 }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setStep('connector')}>← Back</button>
          <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || !selectedFile || scanning}>
            {uploading ? 'Uploading...' : 'Upload Enrichment Source'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── ML Enrichment Table ─────────────────────────────────────────────────── */
const ML_SOURCES = [
  { id: 'ltv', group: 'value', label: 'LTV Scoring', icon: '💰', desc: 'Lifetime value score, tier (High / Medium / Low), and predicted annual value — computed from billing history, subscription tenure, and spend signals', fields: ['ltv_score', 'ltv_tier', 'ltv_band', 'predicted_annual_value'], refresh: 'Daily', source: '1P Billing + Activity' },
  { id: 'engagement', group: 'behavioural', label: 'Engagement Scoring', icon: '📊', desc: 'Engagement rate and tier derived from streaming activity, email opens, app sessions, and content interactions across all touchpoints', fields: ['engagement_rate', 'engagement_tier', 'watch_hours', 'session_frequency'], refresh: 'Daily', source: '1P Streaming + App' },
  { id: 'recency', group: 'behavioural', label: 'Recency Scoring', icon: '🕐', desc: 'Days since last interaction and recency tier (Active / Lapsing / Inactive) — based on last seen date across streaming, app, email and billing events', fields: ['recency_days', 'recency_tier', 'last_seen'], refresh: 'Daily', source: '1P All Events' },
  { id: 'frequency', group: 'behavioural', label: 'Frequency Metrics', icon: '📅', desc: 'Session count, streaming frequency, email interaction rate and visit cadence — used for engagement tier and churn risk modelling', fields: ['session_count_30d', 'stream_frequency', 'email_interaction_rate', 'venue_visits_12m'], refresh: 'Daily', source: '1P Streaming + Email' },
  { id: 'fan', group: 'affinity', label: 'Fan Affinity Scoring', icon: '⭐', desc: 'Fan score (0–100), preferred team, venue visits and merchandise spend band — ML model trained on behavioural signals, ticket history and content consumption', fields: ['fan_score', 'fan_score_band', 'preferred_team', 'merchandise_spend_band', 'fantasy_participation'], refresh: 'Weekly', source: '1P Behavioural + Billing' },
  { id: 'affinity', group: 'affinity', label: 'Content Affinity', icon: '🎯', desc: 'Primary content affinity (Sports / Movies / Music / News / Kids / Documentary) predicted from viewing history and content interactions', fields: ['primary_affinity', 'content_affinity'], refresh: 'Weekly', source: '1P Streaming' },
  { id: 'churn', group: 'affinity', label: 'Churn & Upsell Propensity', icon: '🔮', desc: 'Churn propensity score (0–1), upsell propensity score, and segment code (NEW_ACQUIRABLE / RETAIN / GROW) — gradient-boosted model on engagement and billing signals', fields: ['churn_propensity_score', 'upsell_propensity_score', 'segment_code'], refresh: 'Weekly', source: '1P Billing + Engagement' },
]

const SOURCE_AWARE_ML_SOURCES = {
  media: [
    { id: 'media_ltv', group: 'value', label: 'Subscriber LTV Model', desc: 'Predicted subscriber lifetime value, value tier, and expected annual revenue using subscription tenure, billing, and viewing depth.', fields: ['ltv_score', 'ltv_tier', 'ltv_band', 'predicted_annual_value'], refresh: 'Daily', source: 'Billing + Subscription + Activity' },
    { id: 'media_engagement', group: 'behavioural', label: 'Streaming Engagement Score', desc: 'Engagement score built from watch hours, session cadence, app usage, and email interactions.', fields: ['engagement_rate', 'engagement_tier', 'watch_hours', 'session_frequency'], refresh: 'Daily', source: 'Streaming + App + Email' },
    { id: 'media_recency', group: 'behavioural', label: 'Subscriber Recency Score', desc: 'Days since last meaningful interaction and active/lapsing/inactive status across streaming, app, email, and billing events.', fields: ['recency_days', 'recency_tier', 'last_seen'], refresh: 'Daily', source: 'All Subscriber Events' },
    { id: 'media_content', group: 'affinity', label: 'Content Affinity Model', desc: 'Preferred content genres and affinity bands predicted from viewing history, browse behaviour, and campaign response.', fields: ['primary_affinity', 'content_affinity', 'genre_affinity_score'], refresh: 'Weekly', source: 'Streaming + Content Metadata' },
    { id: 'media_churn', group: 'affinity', label: 'Churn & Upsell Propensity', desc: 'Churn and upsell probabilities used for retention, bundle, and premium-plan activation.', fields: ['churn_propensity_score', 'upsell_propensity_score', 'segment_code'], refresh: 'Weekly', source: 'Billing + Engagement' },
  ],
  sports: [
    { id: 'sports_ltv', group: 'value', label: 'Fan LTV Model', desc: 'Projected fan value from ticketing, merchandise, streaming, loyalty, and event spend signals.', fields: ['fan_ltv_score', 'ltv_band', 'projected_season_value'], refresh: 'Daily', source: 'Ticketing + Commerce + Loyalty' },
    { id: 'sports_engagement', group: 'behavioural', label: 'Fan Engagement Score', desc: 'Engagement tier using app sessions, fantasy play, content views, email response, and game-day interactions.', fields: ['fan_engagement_score', 'engagement_tier', 'app_session_count_30d'], refresh: 'Daily', source: 'App + OTT + Email' },
    { id: 'sports_attendance', group: 'behavioural', label: 'Attendance Propensity', desc: 'Likelihood to attend upcoming games based on ticket history, venue visits, distance, and recent team engagement.', fields: ['attendance_propensity', 'venue_visits_12m', 'ticket_recency_days'], refresh: 'Weekly', source: 'Ticketing + Venue' },
    { id: 'sports_affinity', group: 'affinity', label: 'Team & Player Affinity', desc: 'Preferred team, player, and content affinity scores for targeted offers and personalized experiences.', fields: ['fan_score', 'fan_score_band', 'preferred_team', 'player_affinity'], refresh: 'Weekly', source: 'Behavioural + Content' },
    { id: 'sports_merch', group: 'affinity', label: 'Merchandise Upsell Model', desc: 'Predicted merchandise and membership upsell likelihood from purchase history and engagement moments.', fields: ['merch_upsell_score', 'membership_propensity', 'next_best_offer'], refresh: 'Weekly', source: 'Commerce + Loyalty' },
  ],
  automotive: [
    { id: 'auto_ltv', group: 'value', label: 'Owner Lifetime Value Model', desc: 'Projected owner value using vehicle ownership, service history, loyalty, warranty, and campaign response.', fields: ['owner_ltv_score', 'ltv_tier', 'predicted_service_value'], refresh: 'Daily', source: 'Sales + Service + Loyalty' },
    { id: 'auto_service', group: 'behavioural', label: 'Service Due Propensity', desc: 'Likelihood that an owner is due for scheduled maintenance based on mileage, service intervals, and repair order history.', fields: ['service_due_score', 'next_service_window', 'mileage_band'], refresh: 'Daily', source: 'Service Orders + Telematics' },
    { id: 'auto_safety', group: 'behavioural', label: 'Vehicle Health & Safety Score', desc: 'Composite health and safety score from telematics, DTC events, vehicle health reports, and warranty signals.', fields: ['vehicle_health_score', 'safety_score', 'dtc_risk_band'], refresh: 'Daily', source: 'Telematics + Health Reports' },
    { id: 'auto_retention', group: 'affinity', label: 'Owner Retention Risk', desc: 'Churn and retention risk for service, connected services, loyalty, and insurance programs.', fields: ['retention_risk_score', 'churn_propensity_score', 'loyalty_risk_band'], refresh: 'Weekly', source: 'Loyalty + Campaign + Service' },
    { id: 'auto_upgrade', group: 'affinity', label: 'Vehicle Upgrade Propensity', desc: 'Likelihood to trade in, upgrade, or respond to premium service offers based on ownership age and engagement.', fields: ['upgrade_propensity', 'trade_in_readiness', 'next_best_vehicle_offer'], refresh: 'Weekly', source: 'Ownership + Sales + Campaign' },
  ],
  telecom: [
    { id: 'tel_ltv', group: 'value', label: 'Subscriber Value Model', desc: 'Predicted account value from plan, tenure, billing, device, and usage signals.', fields: ['subscriber_value_score', 'ltv_band', 'predicted_monthly_value'], refresh: 'Daily', source: 'Billing + Usage' },
    { id: 'tel_usage', group: 'behavioural', label: 'Usage Intensity Score', desc: 'Usage tier from network activity, device sessions, data consumption, and support interactions.', fields: ['usage_intensity_score', 'data_usage_band', 'device_activity_tier'], refresh: 'Daily', source: 'Network + Device' },
    { id: 'tel_churn', group: 'affinity', label: 'Churn & Upgrade Propensity', desc: 'Churn, plan upgrade, and device upgrade scores for retention and next-best-action programs.', fields: ['churn_propensity_score', 'upgrade_propensity', 'next_best_action'], refresh: 'Weekly', source: 'Billing + Support + Network' },
  ],
}

function getMlSourcesForSystem(sourceSystem) {
  return SOURCE_AWARE_ML_SOURCES[sourceSystem] || SOURCE_AWARE_ML_SOURCES.media
}

function ModelGlyph({ color = '#8b5cf6' }) {
  return (
    <span style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, border: `1px solid ${color}35`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 18V6" />
        <path d="M20 18V6" />
        <path d="M8 7h8" />
        <path d="M8 12h8" />
        <path d="M8 17h8" />
        <path d="M12 7v10" />
      </svg>
    </span>
  )
}

function MlKpiIcon({ color = '#8b5cf6' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18V6" />
      <path d="M20 18V6" />
      <path d="M8 7h8" />
      <path d="M8 12h8" />
      <path d="M8 17h8" />
      <path d="M12 7v10" />
    </svg>
  )
}

function KpiGlyph({ type, color = 'currentColor' }) {
  const paths = {
    files: ['M7 3h7l4 4v14H7z', 'M14 3v5h5', 'M10 13h6', 'M10 17h4'],
    records: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'],
    partner: ['M8 11a3 3 0 100-6 3 3 0 000 6z', 'M16 11a3 3 0 100-6 3 3 0 000 6z', 'M3 20a5 5 0 0110 0', 'M11 20a5 5 0 0110 0'],
    vendor: ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M12 3c2 2.5 3 5.5 3 9s-1 6.5-3 9', 'M12 3c-2 2.5-3 5.5-3 9s1 6.5 3 9'],
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {(paths[type] || paths.files).map(d => <path key={d} d={d} />)}
    </svg>
  )
}

function MLEnrichmentTable({ sourceSystem = 'media', onAddSource }) {
  const [showDesc, setShowDesc] = useState(false)
  const mlSources = getMlSourcesForSystem(sourceSystem)
  const sourceLabel = SOURCE_SYSTEM_OPTIONS.find(o => o.value === sourceSystem)?.label || 'Media & OTT'
  const groups = [
    { key: 'value', label: 'Value Models' },
    { key: 'behavioural', label: 'Behavioural Models' },
    { key: 'affinity', label: 'Affinity & Propensity Models' },
  ]
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <span className="card-title">Internal ML Enrichment Sources</span>
        <button className="btn btn-primary btn-sm" onClick={onAddSource}>+ Add Enrichment Source</button>
      </div>
      <div style={{ padding: '10px 16px', background: 'rgba(124,58,237,0.06)', borderBottom: '1px solid var(--border)', fontSize: 12, color: '#8b5cf6' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ModelGlyph />
          <span>Source-aware internal models for {sourceLabel}. Signals are computed from first-party data and are not used to create identity links.</span>
        </span>
      </div>
      <div className="data-table-wrapper">
        <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: showDesc ? '16%' : '22%' }} />
            <col style={{ width: '7%' }} />
            {showDesc && <col style={{ width: '25%' }} />}
            <col style={{ width: showDesc ? '25%' : '42%' }} />
            <col style={{ width: showDesc ? '15%' : '20%' }} />
            <col style={{ width: '9%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Model / Signal</th>
              <th>Type</th>
              {showDesc && <th>Description</th>}
              <th>Output Fields</th>
              <th>Source Data</th>
              <th>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span>Refresh</span>
                  <button onClick={() => setShowDesc(p => !p)}
                    style={{ background: showDesc ? 'rgba(167,139,250,0.2)' : 'rgba(100,116,139,0.15)', border: 'none', borderRadius: 4, color: showDesc ? '#a78bfa' : 'var(--text-muted)', fontSize: 9, fontWeight: 700, cursor: 'pointer', padding: '2px 5px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {showDesc ? '▲ Hide' : '▼ Info'}
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ key, label }) => (
              <React.Fragment key={key}>
                <tr>
                  <td colSpan={showDesc ? 6 : 5} style={{ background: 'rgba(167,139,250,0.07)', padding: '7px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                  </td>
                </tr>
                {mlSources.filter(s => s.group === key).map(src => (
                  <tr key={src.id} style={{ verticalAlign: 'top' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ModelGlyph />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{src.label}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 9999 }}>ML</span>
                    </td>
                    {showDesc && (
                      <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {src.desc}
                      </td>
                    )}
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {src.fields.map(f => (
                          <span key={f} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(124,58,237,0.09)', color: '#8b5cf6', border: '1px solid rgba(124,58,237,0.22)', whiteSpace: 'nowrap' }}>{f}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-secondary)' }}>{src.source}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, whiteSpace: 'nowrap' }}>{src.refresh}</span>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}



function KpiCard({ label, value, color = "#2680eb", icon }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${color}1f, transparent 55%)`,
        }}
      />

      {/* icon */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}22`,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          zIndex: 1,
        }}
      >
        {icon}
      </div>

      {/* content */}
      <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </span>

        <div style={{ fontSize: 18, fontWeight: 800 }}>
          {value}
        </div>
      </div>
    </div>
  );
}


/* ── Main DataOverview Component ─────────────────────────────────────────── */
export default function DataOverview() {
  const [inputSourceTab, setInputSourceTab] = useState('data-overview')
  const [searchParams, setSearchParams] = useSearchParams()
  const [sourceSystem, setSourceSystemState] = useState(() => readStoredSourceSystem())
  const setSourceSystem = (value) => {
    const normalizedValue = normalizeSourceSystemValue(value)
    setSourceSystemState(normalizedValue)

    const next = new URLSearchParams(searchParams)
    next.delete('sourceSystem')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    writeStoredSourceSystem(sourceSystem)
  }, [sourceSystem])

  useEffect(() => {
    const urlSourceSystem = normalizeSourceSystemValue(searchParams.get('sourceSystem') || '')
    if (searchParams.get('sourceSystem') && !SOURCE_SYSTEMS.includes(searchParams.get('sourceSystem'))) {
      const next = new URLSearchParams(searchParams)
      next.delete('sourceSystem')
      setSearchParams(next, { replace: true })
    } else if (searchParams.get('sourceSystem') && urlSourceSystem !== sourceSystem) {
      setSourceSystemState(sourceSystem)
      const next = new URLSearchParams(searchParams)
      next.delete('sourceSystem')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, sourceSystem])

  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Loading sources...')
  const [loadError, setLoadError] = useState('')
  const [tagMappings, setTagMappings] = useState(null)
  const [tagMappingsStatus, setTagMappingsStatus] = useState('loading')
  const [classification, setClassification] = useState({})
  const [metadataRefreshing, setMetadataRefreshing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [expandedSource, setExpandedSource] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [completenessData, setCompletenessData] = useState(null)
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [pendingSourceType, setPendingSourceType] = useState(null)
  const [pendingConnector, setPendingConnector] = useState(null)
  const [showConnectorPicker, setShowConnectorPicker] = useState(false)
  const [showConnectionPicker, setShowConnectionPicker] = useState(false)
  const [selectedConnector, setSelectedConnector] = useState(null)
  const [selectedSavedConnection, setSelectedSavedConnection] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showDatabricksModal, setShowDatabricksModal] = useState(false)
  const [showDatabaseModal, setShowDatabaseModal] = useState(false)
  const [showApiModal, setShowApiModal] = useState(false)
  const [showCloudModal, setShowCloudModal] = useState(false)
  const [autoTagSource, setAutoTagSource] = useState(null)
  const [autoTagResults, setAutoTagResults] = useState(null)
  const [autoTagLoading, setAutoTagLoading] = useState(false)
  const [autoTagQueue, setAutoTagQueue] = useState([])
  const [savingTags, setSavingTags] = useState(false)
  const [activeTab, setActiveTab] = useState('1P')
  const [showEnrichmentUpload, setShowEnrichmentUpload] = useState(false)
  const [activeThirdPartyVendor, setActiveThirdPartyVendor] = useState(null)
  const [thirdPartyTables, setThirdPartyTables] = useState([])
  const [thirdPartyLoadingTables, setThirdPartyLoadingTables] = useState(false)
  const [thirdPartyPreview, setThirdPartyPreview] = useState(null)
  const [thirdPartyPreviewing, setThirdPartyPreviewing] = useState(false)
  const [thirdPartyPreviewTable, setThirdPartyPreviewTable] = useState('')
  const [thirdPartyError, setThirdPartyError] = useState('')
  const [thirdPartyMessage, setThirdPartyMessage] = useState('')

  const reload = () => setReloadToken(current => current + 1)

  useEffect(() => {
    if (inputSourceTab !== 'data-overview') return undefined
    let cancelled = false
    let retryTimer = null
    let attempt = 0
    const controller = new AbortController()

    setSources([])
    setLoading(true)
    setLoadingMessage('Loading sources...')
    setLoadError('')
    setMetadataRefreshing(false)

    const loadSources = async () => {
      try {
        const nextSources = await api.getSources(
          sourceSystem,
          { signal: controller.signal }
        )
        if (cancelled) return
        const deferred = nextSources.some(source => source?.metadata_deferred)
        setSources(nextSources)
        setLoadError('')
        setLoading(false)
        setMetadataRefreshing(deferred)
        if (deferred) {
          const delay = Math.min(2000 * (2 ** Math.min(attempt, 3)), 15000)
          attempt += 1
          retryTimer = window.setTimeout(loadSources, delay)
        }
      } catch (error) {
        if (cancelled) return
        if (error?.status === 503) {
          setLoading(true)
          setLoadingMessage('Warming source metadata...')
          setLoadError('')
          setMetadataRefreshing(true)
          const delay = Math.min(2000 * (2 ** Math.min(attempt, 3)), 15000)
          attempt += 1
          retryTimer = window.setTimeout(loadSources, delay)
          return
        }
        setSources([])
        setLoadError(
          error?.message
          || 'Unable to read the configured Unity Catalog source tables.'
        )
        setLoading(false)
        setMetadataRefreshing(false)
      }
    }

    loadSources()
    return () => {
      cancelled = true
      controller.abort()
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [sourceSystem, reloadToken, inputSourceTab])

  useEffect(() => {
    if (inputSourceTab !== 'data-overview') return undefined
    let cancelled = false
    const controller = new AbortController()
    fetch(
      `${API_BASE}/api/data-classification`,
      { signal: controller.signal }
    )
      .then(response => {
        if (!response.ok) throw new Error(`Classification API error: ${response.status}`)
        return response.json()
      })
      .then(payload => {
        if (!cancelled) setClassification(payload.classification || {})
      })
      .catch(() => {
        if (!cancelled) setClassification({})
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [reloadToken, inputSourceTab])

  useEffect(() => {
    if (inputSourceTab !== 'data-overview') return undefined
    let cancelled = false
    let retryTimer = null
    let attempt = 0
    const controller = new AbortController()

    setTagMappingsStatus('loading')
    const loadTagMappings = async () => {
      try {
        const mappings = await api.getTagMappings({ signal: controller.signal })
        if (cancelled) return
        setTagMappings(mappings || {})
        setTagMappingsStatus('ready')
      } catch (error) {
        if (cancelled) return
        if (error?.status === 404) {
          setTagMappings(null)
          setTagMappingsStatus('error')
          return
        }
        setTagMappings(null)
        setTagMappingsStatus('unavailable')
        if (attempt < 24) {
          const delay = Math.min(2000 * (2 ** Math.min(attempt, 3)), 15000)
          attempt += 1
          retryTimer = window.setTimeout(loadTagMappings, delay)
        }
      }
    }

    loadTagMappings()
    return () => {
      cancelled = true
      controller.abort()
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [reloadToken, inputSourceTab])

  useEffect(() => {
    const vendors = THIRD_PARTY_VENDOR_REGISTRY[sourceSystem] || []
    if (vendors.length === 0) {
      setActiveThirdPartyVendor(null)
      return
    }
    if (activeThirdPartyVendor && !vendors.some(vendor => vendor.id === activeThirdPartyVendor)) {
      setActiveThirdPartyVendor(null)
    }
  }, [sourceSystem, activeThirdPartyVendor])

  const thirdPartySavedConnection = getSavedConnectionsFor('warehouse', 'databricks').find(item => item.configured) || null
  const thirdPartyConnectionPayload = {
    connection_mode: thirdPartySavedConnection?.config?.connection_mode || '',
    server_hostname: thirdPartySavedConnection?.config?.server_hostname || '',
    http_path: thirdPartySavedConnection?.config?.http_path || '',
    pat_token: thirdPartySavedConnection?.config?.pat_token || '',
  }
  const canLoadThirdPartyConnection = thirdPartyConnectionPayload.connection_mode === 'runtime' || (
    thirdPartyConnectionPayload.server_hostname
    && thirdPartyConnectionPayload.http_path
    && thirdPartyConnectionPayload.pat_token
  )
  const thirdPartyLocation = THIRD_PARTY_DATABRICKS_LOCATION[sourceSystem] || null
  const thirdPartyCatalog = thirdPartyLocation?.catalog || ''
  const thirdPartySchema = thirdPartyLocation?.schema || ''

  const loadThirdPartyTables = async () => {
    if (!canLoadThirdPartyConnection) {
      setThirdPartyError('Saved Databricks connection is incomplete.')
      return
    }
    if (!thirdPartyCatalog || !thirdPartySchema) {
      setThirdPartyError(`No 3P Databricks location is configured for ${sourceSystem}.`)
      return
    }
    setThirdPartyError('')
    setThirdPartyMessage('')
    setThirdPartyPreview(null)
    setThirdPartyPreviewTable('')
    setThirdPartyLoadingTables(true)
    try {
      const result = await api.databricksTables({
        ...thirdPartyConnectionPayload,
        catalog: thirdPartyCatalog,
        schema: thirdPartySchema,
      })
      setThirdPartyTables(result.tables || [])
      setThirdPartyMessage(`Loaded tables from ${thirdPartyCatalog}.${thirdPartySchema}.`)
    } catch (e) {
      setThirdPartyError(e.message)
    }
    setThirdPartyLoadingTables(false)
  }

  const previewThirdPartyTable = async (tableName) => {
    if (!thirdPartyCatalog || !thirdPartySchema || !tableName) return
    if (thirdPartyPreviewTable === tableName) {
      setThirdPartyPreviewTable('')
      setThirdPartyPreview(null)
      return
    }
    setThirdPartyPreviewing(true)
    setThirdPartyError('')
    setThirdPartyPreviewTable(tableName)
    try {
      const result = await api.databricksPreview({
        ...thirdPartyConnectionPayload,
        catalog: thirdPartyCatalog,
        schema: thirdPartySchema,
        table: tableName,
        limit: 10,
      })
      setThirdPartyPreview(result)
    } catch (e) {
      setThirdPartyError(e.message)
    }
    setThirdPartyPreviewing(false)
  }

  useEffect(() => {
    if (activeTab !== '3P') return
    if (!canLoadThirdPartyConnection) return
    if (!thirdPartyLocation) return
    loadThirdPartyTables()
  }, [activeTab, canLoadThirdPartyConnection, sourceSystem])

  const togglePreview = async (name) => {
    if (expandedSource === name) { setExpandedSource(null); setPreviewData(null); setCompletenessData(null); return }
    setExpandedSource(name); setPreviewLoading(true)
    try {
      const [data, comp] = await Promise.all([api.getSourceRandom(name, 50), api.getSourceCompleteness(name)])
      setPreviewData(data); setCompletenessData(comp)
    } catch { setPreviewData(null); setCompletenessData(null) }
    setPreviewLoading(false)
  }

  const refreshPreview = async (name) => {
    setPreviewLoading(true)
    try { setPreviewData(await api.getSourceRandom(name, 50)) } catch { setPreviewData(null) }
    setPreviewLoading(false)
  }

  const handleUploadComplete = async (result) => {
    setShowUpload(false); setAutoTagSource(result.name); setAutoTagLoading(true)
    try { setAutoTagResults(await api.autoTagSource(result.name)) } catch { setAutoTagResults(null) }
    setAutoTagLoading(false); reload()
  }

  const runAutoTagForSource = async (sourceName) => {
    setAutoTagSource(sourceName)
    setAutoTagLoading(true)
    try { setAutoTagResults(await api.autoTagSource(sourceName)) } catch { setAutoTagResults(null) }
    setAutoTagLoading(false)
  }

  const handleDatabricksIngestComplete = async (results) => {
    const ingested = Array.isArray(results) ? results : [results]
    setShowDatabricksModal(false)
    setShowDatabaseModal(false)
    setShowApiModal(false)
    setShowCloudModal(false)
    setSelectedConnector(null)
    setSelectedSavedConnection(null)
    setPendingSourceType(null)
    setPendingConnector(null)
    const names = ingested.map(item => item?.name).filter(Boolean)
    if (names.length > 0) {
      setAutoTagQueue(names.slice(1))
      await runAutoTagForSource(names[0])
    }
    reload()
  }

  const handleAutoTag = async (name) => {
    setAutoTagSource(name); setAutoTagLoading(true); setAutoTagResults(null)
    try { setAutoTagResults(await api.autoTagSource(name)) } catch { /* silent */ }
    setAutoTagLoading(false)
  }

  const handleAcceptTags = async (edits) => {
    setSavingTags(true)
    try {
      const sourceMapping = {}
      Object.entries(edits).forEach(([col, tag]) => { if (tag) sourceMapping[col] = tag })
      const updated = { ...(tagMappings || {}), [autoTagSource]: sourceMapping }
      await api.updateTagMappings(updated)
      setTagMappings(updated)
      const [nextSource, ...remaining] = autoTagQueue
      setAutoTagQueue(remaining)
      if (nextSource) {
        await runAutoTagForSource(nextSource)
      } else {
        setAutoTagSource(null)
        setAutoTagResults(null)
      }
    } catch { /* silent */ }
    setSavingTags(false)
  }

  const handleDeleteSource = async (name) => {
    if (!window.confirm(`Delete source "${name}" and its tag mappings?`)) return
    try { await api.deleteSource(name); reload() } catch { /* silent */ }
  }

  const handleSavedConnectionSelected = ({ connector, connection }) => {
    setShowConnectionPicker(false)
    setPendingSourceType(null)
    setPendingConnector(null)
    setSelectedConnector(connector)
    setSelectedSavedConnection(connection)
    if (connector?.id === 'databricks') {
      setShowDatabricksModal(true)
    } else if (connector?.id === 'postgresql' || connector?.id === 'mysql') {
      setShowDatabaseModal(true)
    } else if (connector?.id === 'rest_api') {
      setShowApiModal(true)
    } else if (connector?.id === 'azure_blob' || connector?.id === 'amazon_s3') {
      setShowCloudModal(true)
    } else {
      window.alert(`${connector?.label || 'This connector'} is scaffolded, but its ingest browser is not enabled yet.`)
    }
  }

  const allFirstPartySources = sources.filter(source => {
    const configured = getClassificationForSource(classification, source)
    return (configured.party || source.party || '1P') === '1P'
  })
  const firstPartySources = Array.from(
    allFirstPartySources
      .filter(s => getSourceSystem(s.name) === sourceSystem)
      .reduce((map, src) => {
        const key = sourceBasename(src.name)
        if (!map.has(key)) map.set(key, src)
        return map
      }, new Map())
      .values()
  )
  const totalRows = firstPartySources.reduce((s, src) => s + src.rows, 0)
  const sourcePrefix = getSourceSystemPrefix(sourceSystem)
  const thirdPartyDatabricksTables = thirdPartyTables
    .filter(item => {
      const lower = String(item?.name || '').toLowerCase()
      return sourcePrefix ? lower.startsWith(`${sourcePrefix}_3p_`) : false
    })
  const thirdPartyConnectionFailed = Boolean(thirdPartyError)
  const thirdPartyVendors = (THIRD_PARTY_VENDOR_REGISTRY[sourceSystem] || []).map(vendor => {
    const liveTables = thirdPartyDatabricksTables
      .filter(item => inferThirdPartyVendorTable(item.name, [vendor]))
      .map(item => ({
        tableName: item.name,
        type: item.type,
        category: inferThirdPartyTableCategory(item.name),
        matchKeys: vendor.matchKeys,
        isLive: true,
      }))
    const fallbackTables = (vendor.expectedTables || []).map(tableName => ({
      tableName,
      type: 'TABLE',
      category: inferThirdPartyFallbackTableCategory(tableName),
      matchKeys: vendor.matchKeys,
      isLive: false,
    }))
    const tablesForVendor = liveTables.length > 0 ? liveTables : fallbackTables
    return {
      ...vendor,
      tables: tablesForVendor,
      hasLiveTables: liveTables.length > 0,
    }
  })
  const activeThirdPartyVendorRecord = thirdPartyVendors.find(vendor => vendor.id === activeThirdPartyVendor) || null
  const thirdPartyDatasetCount = thirdPartyVendors.reduce((sum, vendor) => sum + vendor.tables.length, 0)

  const closeConnectorModals = () => {
    setShowDatabricksModal(false)
    setShowDatabaseModal(false)
    setShowApiModal(false)
    setShowCloudModal(false)
    setSelectedConnector(null)
    setSelectedSavedConnection(null)
  }

  const backToSavedConnections = () => {
    setShowDatabricksModal(false)
    setShowDatabaseModal(false)
    setShowApiModal(false)
    setShowCloudModal(false)
    setSelectedSavedConnection(null)
    setShowConnectionPicker(true)
  }

  const backToSourceTypes = () => {
    setShowConnectorPicker(false)
    setShowConnectionPicker(false)
    setPendingConnector(null)
    setShowSourcePicker(true)
  }

  const backToConnectorList = () => {
    setShowConnectionPicker(false)
    setSelectedSavedConnection(null)
    setShowConnectorPicker(true)
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" /> {loadingMessage}
      </div>
    )
  }

  const tabBtn = (id, label, count) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding: '7px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: 'none', fontFamily: 'inherit', transition: 'all 0.15s',
      background: activeTab === id ? 'var(--accent)' : 'var(--bg-secondary)',
      color: activeTab === id ? '#fff' : 'var(--text-muted)',
    }}>{label}{count !== null ? ` (${count})` : ''}</button>
  )

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="page-title">Input Sources</h1>
          <p className="page-description">Source data files ingested into the identity resolution pipeline</p>
          {metadataRefreshing && (
            <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)' }}>
              Showing the last validated source inventory while live warehouse metadata refreshes.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Source System
          </label>
          <select
            value={sourceSystem}
            onChange={e => setSourceSystem(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {SOURCE_SYSTEM_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Input Sources tab bar ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'data-overview', label: 'Data Overview' },
          { id: 'data-quality', label: 'Data Quality Reporting' },
          { id: 'cleansing', label: 'Cleansing & Standardization' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setInputSourceTab(tab.id)}
            style={{
              padding: '9px 20px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: inputSourceTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              color: inputSourceTab === tab.id ? 'var(--accent-light)' : 'var(--text-muted)',
              fontFamily: 'inherit',
              marginBottom: -1,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {inputSourceTab === 'cleansing' && <CleaningStandardization_TabView />}
      {inputSourceTab === 'data-quality' && <DataQualityReportingView />}
      {inputSourceTab === 'data-overview' && <div className="page-body">
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
              <div style={{ fontSize: 13, fontWeight: 700 }}>Source data is temporarily unavailable</div>
              <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5 }}>{loadError}</div>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={reload}>Retry</button>
          </div>
        )}

        {/* ── KPIs ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <KpiCard
            label="1st Party Source Tables"
            value={firstPartySources.length}
            color="#10b981"
            icon={<KpiGlyph type="files" />}
          />

          <KpiCard
            label="Total Records"
            value={totalRows.toLocaleString()}
            color="#3b82f6"
            icon={<KpiGlyph type="records" />}
          />

          <KpiCard
            label="ML Enrichment Models"
            value={getMlSourcesForSystem(sourceSystem).length}
            color="#a78bfa"
            icon={<MlKpiIcon />}
          />

          <KpiCard
            label="2nd Party Sources"
            value="0"
            color="#3b82f6"
            icon={<KpiGlyph type="partner" />}
          />

          <KpiCard
            label="3rd Party Sources"
            value={thirdPartyDatasetCount}
            color="#f59e0b"
            icon={<KpiGlyph type="vendor" />}
          />
        </div>

        {/* ── Auto-Tag Review Panel ── */}
        {autoTagLoading && (
          <div className="card" style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div className="spinner" style={{ marginBottom: 12 }} />
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Running semantic similarity on <code>{autoTagSource}</code> columns...</div>
            </div>
          </div>
        )}
        {autoTagResults && !autoTagLoading && (
          <AutoTagPanel source={autoTagSource} tagResults={autoTagResults} onAccept={handleAcceptTags}
            onCancel={() => { setAutoTagSource(null); setAutoTagResults(null) }} saving={savingTags} />
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {tabBtn('1P', '🔒 First Party', firstPartySources.length)}
          {tabBtn('ML', 'ML Enrichment', null)}
          {tabBtn('2P', '🤝 Second Party (2P)', null)}
          {tabBtn('3P', '🌐 Third Party (3P)', null)}
        </div>

        {/* ── 1P Sources ── */}
        {activeTab === '1P' && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">First Party Sources — Identity Resolution</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowSourcePicker(true)}>+ Add Source</button>
            </div>
            <div style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.05)', borderBottom: '1px solid var(--border)', fontSize: 11, color: '#10b981' }}>
              ✓ These sources are eligible for identity graph creation and blocking configuration
            </div>
            <div className="data-table-wrapper">
              {firstPartySources.length === 0 && (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    No {SOURCE_SYSTEM_OPTIONS.find(o => o.value === sourceSystem)?.label} sources yet
                  </div>
                  <div style={{ fontSize: 12 }}>
                    {sourceSystem === 'telecom'
                      ? 'Telecom data has not been loaded into the pipeline yet.'
                      : `Drop source CSV files into generated_data/${sourceSystem}/ to get started.`}
                  </div>
                </div>
              )}
              {firstPartySources.length > 0 && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}></th>
                      <th>Source</th>
                      <th>Party</th>
                      <th>Type</th>
                      <th>Usage</th>
                      <th>Rows</th>
                      <th>Cols</th>
                      <th>Canonical Tags</th>
                      <th style={{ width: 120 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {firstPartySources.map(src => {
                      const sourceTagMapping = getSourceTagMapping(tagMappings, src.name)
                      const tags = sourceTagMapping ? [...new Set(Object.values(sourceTagMapping))] : []
                      const isExpanded = expandedSource === src.name
                      const cls = {
                        party: src.party || '1P',
                        source_type: src.source_type || 'Internal',
                        use_for_identity: src.use_for_identity ?? true,
                        ...getClassificationForSource(classification, src),
                      }
                      return (
                        <React.Fragment key={src.name}>
                          <tr className="expandable-row" onClick={() => togglePreview(src.name)} style={{ cursor: 'pointer' }}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{isExpanded ? '▼' : '▶'}</td>
                            <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cleanDisplayName(src.display_name)}</td>
                            <td><PartyBadge party={cls.party} /></td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cls.source_type}</td>
                            <td><UsageBadge useForIdentity={cls.use_for_identity} /></td>
                            <td>{src.rows.toLocaleString()}</td>
                            <td>{src.columns.length}</td>
                            <td>
                              {tagMappingsStatus !== 'ready'
                                ? (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                                    {tagMappingsStatus === 'error'
                                      ? 'Canonical mappings are not configured'
                                      : 'Canonical mappings temporarily unavailable'}
                                  </span>
                                )
                                : tags.length > 0
                                  ? <ExpandableTags tags={tags} />
                                  : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                                      No tags
                                    </span>
                                  )}
                            </td>
                            <td onClick={e => e.stopPropagation()} style={{ gap: 4 }}>
                              <button className="btn btn-sm btn-secondary" onClick={() => handleAutoTag(src.name)} disabled={autoTagLoading} style={{ fontSize: 11, padding: '3px 8px' }}>
                                {tags.length > 0 ? 'Re-tag' : 'Auto-tag'}
                              </button>
                              <button className="btn btn-sm" onClick={() => handleDeleteSource(src.name)} style={{ fontSize: 11, padding: '3px 8px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>✕</button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`preview-${src.name}`}>
                              <td colSpan={9} style={{ padding: 0 }}>
                                <div style={{ padding: 16, background: 'var(--bg-secondary)' }}>
                                  {sourceTagMapping && (
                                    <div className="mb-16">
                                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Column → Canonical Tag Mapping</div>
                                      <div className="data-table-wrapper" style={{ maxHeight: 220, overflow: 'auto' }}>
                                        <table className="data-table">
                                          <thead><tr><th>Original Column</th><th></th><th>Canonical Tag</th></tr></thead>
                                          <tbody>
                                            {Object.entries(sourceTagMapping).map(([col, tag]) => (
                                              <tr key={col}>
                                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{col}</td>
                                                <td style={{ color: 'var(--text-muted)', textAlign: 'center', width: 40 }}>→</td>
                                                <td><span className="tag-chip">{tag}</span></td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex-between mb-16">
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>Random Sample: {previewData?.rows?.length || 0} records</span>
                                    <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); refreshPreview(src.name) }} disabled={previewLoading}>{previewLoading ? 'Loading...' : 'Refresh'}</button>
                                  </div>
                                  {previewLoading
                                    ? <div className="loading" style={{ padding: 24 }}><div className="spinner" /> Loading...</div>
                                    : previewData ? (
                                      <div className="data-table-wrapper" style={{ maxHeight: 350, overflow: 'auto' }}>
                                        <table className="data-table">
                                          <thead>
                                            <tr>{previewData.columns.map(col => <th key={col}>{col}</th>)}</tr>
                                            {completenessData && (
                                              <tr>
                                                {previewData.columns.map(col => {
                                                  const pct = completenessData.columns?.[col]
                                                  const color = pct >= 90 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
                                                  return <th key={`c-${col}`} style={{ fontWeight: 400, fontSize: 11, color, padding: '2px 8px', borderTop: 'none' }}>{pct != null ? `${pct}%` : '-'}</th>
                                                })}
                                              </tr>
                                            )}
                                          </thead>
                                          <tbody>
                                            {previewData.rows.map((row, i) => (
                                              <tr key={i}>{previewData.columns.map(col => <td key={col}>{row[col]}</td>)}</tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>No data available</div>
                                  }
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── ML Enrichment ── */}
        {activeTab === 'ML' && (
          <MLEnrichmentTable sourceSystem={sourceSystem} onAddSource={() => setShowEnrichmentUpload(true)} />
        )}

        {/* ── 2P — Empty ── */}
        {activeTab === '2P' && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">🤝 Second Party (2P) — Partner Data</span>
            </div>
            <div style={{ padding: '8px 16px', background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid var(--border)', fontSize: 11, color: '#3b82f6' }}>
              Partner / clean room data — purchase history, travel signals, venue data. Enrichment only.
            </div>
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No Partner Sources Connected</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
                Second-party data comes from direct partner relationships and clean rooms.
                When partner integrations are configured, sources will appear here.
              </div>
            </div>
          </div>
        )}

        {/* ── 3P — Empty ── */}
        {activeTab === '3P' && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">🌐 Third Party (3P) — Vendor Data</span>
            </div>
            <div style={{ padding: '8px 16px', background: 'rgba(245,158,11,0.05)', borderBottom: '1px solid var(--border)', fontSize: 11, color: '#f59e0b' }}>
              Vendor data — demographics, location signals. Enrichment only. Privacy-safe match keys.
            </div>
            {thirdPartyVendors.length === 0 ? (
              <div style={{ padding: '48px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🌐</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No Third-Party Sources Registered</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
                  Register vendor packages for the selected source system to show third-party enrichment datasets here.
                </div>
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {thirdPartyVendors.map(vendor => {
                    const isActive = vendor.id === activeThirdPartyVendorRecord?.id
                    return (
                      <button
                        key={vendor.id}
                        type="button"
                        onClick={() => {
                          setActiveThirdPartyVendor(current => current === vendor.id ? null : vendor.id)
                          setThirdPartyPreviewTable('')
                          setThirdPartyPreview(null)
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '16px 18px',
                          borderRadius: 12,
                          border: `1px solid ${isActive ? '#f59e0b' : 'var(--border)'}`,
                          background: isActive ? 'rgba(245,158,11,0.08)' : 'var(--bg-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{vendor.name}</div>
                          <PartyBadge party="3P" />
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{vendor.tables.length} table{vendor.tables.length === 1 ? '' : 's'}</span>
                          <span style={{ color: vendor.tables.length > 0 ? '#10b981' : 'var(--text-muted)' }}>{vendor.tables.length > 0 ? 'available' : 'no tables'}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 11, color: thirdPartyError ? '#dc2626' : thirdPartyMessage ? '#10b981' : 'var(--text-muted)' }}>
                    {thirdPartyError || thirdPartyMessage || 'Vendor tables are loaded for the selected source system.'}
                  </div>
                  <button className="btn btn-secondary" onClick={loadThirdPartyTables} disabled={thirdPartyLoadingTables}>
                    {thirdPartyLoadingTables ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>

                {thirdPartyConnectionFailed && (
                  <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontSize: 12 }}>
                    Live Databricks connection failed. Showing configured vendors and registered tables only.
                  </div>
                )}

                {!activeThirdPartyVendorRecord && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Select a vendor to view available third-party tables, columns, and sample rows.
                  </div>
                )}

                {activeThirdPartyVendorRecord && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{activeThirdPartyVendorRecord.name}</div>
                        </div>
                        <UsageBadge useForIdentity={false} />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <ExpandableTags tags={activeThirdPartyVendorRecord.matchKeys} />
                      </div>
                    </div>

                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Table</th>
                            <th>Category</th>
                            <th>Match Keys</th>
                            <th>Type</th>
                            <th style={{ width: 120 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeThirdPartyVendorRecord.tables.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                                {thirdPartyConnectionFailed
                                  ? `No registered ${activeThirdPartyVendorRecord.name} tables are configured yet.`
                                  : `No ${activeThirdPartyVendorRecord.name} tables found in the selected schema.`}
                              </td>
                            </tr>
                          )}
                          {activeThirdPartyVendorRecord.tables.map(file => {
                            const isExpanded = thirdPartyPreviewTable === file.tableName
                            return (
                              <React.Fragment key={file.tableName}>
                                <tr
                                  className="expandable-row"
                                  onClick={() => previewThirdPartyTable(file.tableName)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{file.tableName}</div>
                                  </td>
                                  <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{file.category}</td>
                                  <td><ExpandableTags tags={file.matchKeys} /></td>
                                  <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{file.type || 'TABLE'}</td>
                                  <td onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      <button className="btn btn-sm btn-secondary" onClick={() => file.isLive && previewThirdPartyTable(file.tableName)} disabled={!file.isLive || (thirdPartyPreviewing && thirdPartyPreviewTable === file.tableName)}>
                                        {!file.isLive ? 'Unavailable' : (thirdPartyPreviewing && thirdPartyPreviewTable === file.tableName ? 'Loading...' : 'Preview')}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {isExpanded && file.isLive && (
                                  <tr>
                                    <td colSpan={5} style={{ padding: 0 }}>
                                      <div style={{ padding: 16, background: 'var(--bg-secondary)' }}>
                                        <div className="flex-between mb-16">
                                          <span style={{ fontSize: 13, fontWeight: 600 }}>Preview: {thirdPartyCatalog}.{thirdPartySchema}.{file.tableName}</span>
                                          <button className="btn btn-sm btn-secondary" onClick={e => { e.stopPropagation(); previewThirdPartyTable(file.tableName) }} disabled={thirdPartyPreviewing}>
                                            {thirdPartyPreviewing ? 'Loading...' : 'Refresh'}
                                          </button>
                                        </div>
                                        {thirdPartyPreviewing
                                          ? <div className="loading" style={{ padding: 24 }}><div className="spinner" /> Loading...</div>
                                          : thirdPartyPreview ? (
                                            <div>
                                              <div className="mb-16">
                                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Columns</div>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                  {thirdPartyPreview.columns.map(col => <span key={col} className="tag-chip">{col}</span>)}
                                                </div>
                                              </div>
                                              <div className="data-table-wrapper" style={{ maxHeight: 350, overflow: 'auto' }}>
                                                <table className="data-table">
                                                  <thead>
                                                    <tr>{thirdPartyPreview.columns.map(col => <th key={col}>{col}</th>)}</tr>
                                                  </thead>
                                                  <tbody>
                                                    {thirdPartyPreview.rows.map((row, i) => (
                                                      <tr key={i}>{thirdPartyPreview.columns.map(col => <td key={col}>{row[col]}</td>)}</tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          ) : <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>No data available</div>
                                        }
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {isExpanded && !file.isLive && (
                                  <tr>
                                    <td colSpan={5} style={{ padding: 0 }}>
                                      <div style={{ padding: 24, background: 'var(--bg-secondary)', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        Live preview unavailable because the Databricks connection is currently failing. Retry once the connection is restored.
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
                    <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      These tables are being browsed directly from Databricks. Use the selected sports schema as the source of truth for vendor data, then ingest the needed vendor tables into the existing CDP flow.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>}

      {showSourcePicker && <SourceTypePicker onClose={() => setShowSourcePicker(false)} onSelect={type => {
        setShowSourcePicker(false)
        if (type === 'file') setShowUpload(true)
        if (type !== 'file') {
          setPendingSourceType(type)
          setShowConnectorPicker(true)
        }
      }} />}
      {showConnectorPicker && <ConnectorPickerModal sourceType={pendingSourceType} onClose={() => { setShowConnectorPicker(false); setPendingSourceType(null) }} onBack={backToSourceTypes} onSelect={(connector) => { setPendingConnector(connector); setShowConnectorPicker(false); setShowConnectionPicker(true) }} />}
      {showConnectionPicker && <SavedConnectionPickerModal sourceType={pendingSourceType} connector={pendingConnector} onClose={() => { setShowConnectionPicker(false); setPendingSourceType(null); setPendingConnector(null) }} onBack={backToConnectorList} onSelect={handleSavedConnectionSelected} />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={handleUploadComplete} />}
      {showDatabricksModal && <DatabricksModal onClose={closeConnectorModals} onBack={backToSavedConnections} onIngested={handleDatabricksIngestComplete} sourceSystem={sourceSystem} savedConnection={selectedSavedConnection} />}
      {showDatabaseModal && (
        <DatabaseConnectorModal
          onClose={closeConnectorModals}
          onBack={backToSavedConnections}
          onIngested={handleDatabricksIngestComplete}
          sourceSystem={sourceSystem}
          savedConnection={selectedSavedConnection}
          connectorId={selectedConnector?.id}
          connectorLabel={selectedConnector?.label}
        />
      )}
      {showApiModal && (
        <ApiConnectorModal
          onClose={closeConnectorModals}
          onBack={backToSavedConnections}
          onIngested={handleDatabricksIngestComplete}
          sourceSystem={sourceSystem}
          savedConnection={selectedSavedConnection}
        />
      )}
      {showCloudModal && (
        <ObjectStorageModal
          onClose={closeConnectorModals}
          onBack={backToSavedConnections}
          onIngested={handleDatabricksIngestComplete}
          sourceSystem={sourceSystem}
          savedConnection={selectedSavedConnection}
          connectorId={selectedConnector?.id}
          connectorLabel={selectedConnector?.label}
        />
      )}
      {showEnrichmentUpload && (
        <EnrichmentUploadModal onClose={() => setShowEnrichmentUpload(false)} onUploaded={() => { setShowEnrichmentUpload(false); reload() }} />
      )}
    </>
  )
}

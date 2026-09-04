import { useState, useEffect } from 'react'
import { api } from '../api'

const API_BASE = ""

function methodLabel(method) {
  if (method === 'phonetic') return 'Prefix Match'
  if (method === 'jaro_winkler') return 'Prefix Match'
  return 'Exact'
}

const PRIMARY_TAG_DEFAULTS = {
  email: {
    tags: {
      email:      { comparison_method: 'exact',    match_threshold: 1.0,  weight: 52 },
      phone:      { comparison_method: 'exact',    match_threshold: 1.0,  weight: 28 },
      first_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 12 },
      last_name:  { comparison_method: 'phonetic', match_threshold: 0.85, weight: 13 },
      address:    { comparison_method: 'exact',    match_threshold: 1.0,  weight: 8  },
      zip:        { comparison_method: 'exact',    match_threshold: 1.0,  weight: 5  },
      device_id:  { comparison_method: 'exact',    match_threshold: 1.0,  weight: 18 },
      ip_address: { comparison_method: 'exact',    match_threshold: 1.0,  weight: 8  },
    },
    rules: [
      { name: 'Email Match',   chain: [{ tag: 'email', char_count: null }],                                                                              enabled: true },
      { name: 'Phone Match',   chain: [{ tag: 'phone', char_count: null }],                                                                              enabled: true },
      { name: 'Name + Zip',    chain: [{ tag: 'first_name', char_count: 3 }, { tag: 'last_name', char_count: 4 }, { tag: 'zip', char_count: null }],     enabled: true },
      { name: 'Address + Zip', chain: [{ tag: 'address', char_count: null }, { tag: 'zip', char_count: null }],                                          enabled: true },
      { name: 'Device ID',     chain: [{ tag: 'device_id', char_count: null }],                                                                          enabled: true },
      { name: 'IP Address',    chain: [{ tag: 'ip_address', char_count: null }],                                                                         enabled: true },
    ],
  },
  phone: {
    tags: {
      phone:      { comparison_method: 'exact',    match_threshold: 1.0,  weight: 50 },
      email:      { comparison_method: 'exact',    match_threshold: 1.0,  weight: 30 },
      first_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 12 },
      last_name:  { comparison_method: 'phonetic', match_threshold: 0.85, weight: 13 },
      address:    { comparison_method: 'exact',    match_threshold: 1.0,  weight: 10 },
      zip:        { comparison_method: 'exact',    match_threshold: 1.0,  weight: 5  },
      device_id:  { comparison_method: 'exact',    match_threshold: 1.0,  weight: 15 },
      ip_address: { comparison_method: 'exact',    match_threshold: 1.0,  weight: 6  },
    },
    rules: [
      { name: 'Phone Match',   chain: [{ tag: 'phone', char_count: null }],                                                                              enabled: true },
      { name: 'Email Match',   chain: [{ tag: 'email', char_count: null }],                                                                              enabled: true },
      { name: 'Name + Zip',    chain: [{ tag: 'first_name', char_count: 3 }, { tag: 'last_name', char_count: 4 }, { tag: 'zip', char_count: null }],     enabled: true },
      { name: 'Address + Zip', chain: [{ tag: 'address', char_count: null }, { tag: 'zip', char_count: null }],                                          enabled: true },
      { name: 'Device ID',     chain: [{ tag: 'device_id', char_count: null }],                                                                          enabled: true },
      { name: 'IP Address',    chain: [{ tag: 'ip_address', char_count: null }],                                                                         enabled: true },
    ],
  },
  device_id: {
    tags: {
      device_id:  { comparison_method: 'exact',    match_threshold: 1.0,  weight: 50 },
      email:      { comparison_method: 'exact',    match_threshold: 1.0,  weight: 25 },
      phone:      { comparison_method: 'exact',    match_threshold: 1.0,  weight: 20 },
      ip_address: { comparison_method: 'exact',    match_threshold: 1.0,  weight: 15 },
      first_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 8  },
      last_name:  { comparison_method: 'phonetic', match_threshold: 0.85, weight: 8  },
      address:    { comparison_method: 'exact',    match_threshold: 1.0,  weight: 5  },
      zip:        { comparison_method: 'exact',    match_threshold: 1.0,  weight: 4  },
    },
    rules: [
      { name: 'Device ID',     chain: [{ tag: 'device_id', char_count: null }],                                                                          enabled: true },
      { name: 'Email Match',   chain: [{ tag: 'email', char_count: null }],                                                                              enabled: true },
      { name: 'Phone Match',   chain: [{ tag: 'phone', char_count: null }],                                                                              enabled: true },
      { name: 'IP Address',    chain: [{ tag: 'ip_address', char_count: null }],                                                                         enabled: true },
      { name: 'Name + Zip',    chain: [{ tag: 'first_name', char_count: 3 }, { tag: 'last_name', char_count: 4 }, { tag: 'zip', char_count: null }],     enabled: true },
      { name: 'Address + Zip', chain: [{ tag: 'address', char_count: null }, { tag: 'zip', char_count: null }],                                          enabled: true },
    ],
  },
}

const TIER_STYLES = {
  exact:  { background: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
  strong: { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  medium: { background: 'rgba(249,115,22,0.15)', color: '#f97316' },
  weak:   { background: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
}

function SectionHeader({ title, subtitle, collapsed, onToggle, badge }) {
  return (
    <div className="card-header" onClick={onToggle} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-block', fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
        <span className="card-title">{title}</span>
        {badge && <span className="badge badge-strong" style={{ fontSize: 10 }}>{badge}</span>}
      </div>
      {subtitle && !collapsed && <span className="card-subtitle">{subtitle}</span>}
    </div>
  )
}

export default function BlockingConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [primaryTag, setPrimaryTag] = useState('')
  const [configured, setConfigured] = useState(false)
  const [classification, setClassification] = useState({})
  const [profileMode,    setProfileMode]    = useState(false)
  const [profileModeInfo,setProfileModeInfo]= useState(null)

  const [tagsCollapsed, setTagsCollapsed] = useState(true)
  const [rulesCollapsed, setRulesCollapsed] = useState(false)
  const [thresholdCollapsed, setThresholdCollapsed] = useState(false)

  const PREF_TAGS = ['email', 'phone', 'address']
  const GLOBAL_STRATEGIES = [
    { value: 'preferred_source', label: 'Most Preferred Source' },
    { value: 'most_recent',      label: 'Most Recent'           },
    { value: 'most_frequent',    label: 'Most Frequent'         },
  ]
  const [globalStrategy, setGlobalStrategy] = useState('preferred_source')
  const [sourcePrefs, setSourcePrefs] = useState({})
  const [canonicalTagsSources, setCanonicalTagsSources] = useState({})
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsSaved, setPrefsSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      api.getBlockingConfig(),
      api.getSourcePreferences().catch(() => ({})),
      api.getCanonicalTagsSources().catch(() => ({})),
      fetch(`${API_BASE}/api/data-classification`).then(r => r.json()).catch(() => ({ classification: {} })),
      fetch(`${API_BASE}/api/profile-mode`).then(r => r.json()).catch(() => ({ profile_mode: false })),
    ]).then(([c, prefs, tagSources, cls, pm]) => {
      setProfileMode(pm.profile_mode)
      setProfileModeInfo(pm)
      setConfig(c)
      setSourcePrefs(prefs)
      setCanonicalTagsSources(tagSources)
      setClassification(cls.classification || {})
      if (c?.primary_tag) {
        setPrimaryTag(c.primary_tag)
        setConfigured(true)
        setConfig(prev => ({
          ...prev,
          tags: { ...(PRIMARY_TAG_DEFAULTS[c.primary_tag]?.tags || prev?.tags) },
          blocking_rules: [...(PRIMARY_TAG_DEFAULTS[c.primary_tag]?.rules || prev?.blocking_rules)],
        }))
      }
      const strategies = PREF_TAGS.map(t => (prefs[t] || {}).strategy).filter(Boolean)
      const allSame = strategies.length > 0 && strategies.every(s => s === strategies[0])
      if (allSame && (strategies[0] === 'most_recent' || strategies[0] === 'most_frequent')) {
        setGlobalStrategy(strategies[0])
      } else {
        setGlobalStrategy('preferred_source')
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const firstPartySources = Object.entries(classification)
    .filter(([, cls]) => cls.party === '1P')
    .map(([name]) => name)

  const autoConfigure = () => {
    if (!primaryTag || !config) return
    const defaults = PRIMARY_TAG_DEFAULTS[primaryTag]
    if (!defaults) return
    setConfig(prev => ({ ...prev, tags: { ...defaults.tags }, blocking_rules: [...defaults.rules] }))
    setConfigured(true)
    setSaved(false)
  }

  const updateEdgeTier = (tier, field, value) => {
    setConfig(prev => ({ ...prev, edge_tiers: { ...prev.edge_tiers, [tier]: { ...prev.edge_tiers[tier], [field]: value } } }))
    setSaved(false)
  }

  const handleGlobalStrategyChange = (strategy) => {
    setGlobalStrategy(strategy)
    if (strategy !== 'preferred_source') {
      const updated = {}
      PREF_TAGS.forEach(tag => { updated[tag] = { source: '', strategy } })
      setSourcePrefs(updated)
    } else {
      setSourcePrefs(prev => {
        const updated = {}
        PREF_TAGS.forEach(tag => {
          const entry = prev[tag] || {}
          updated[tag] = { source: entry.source || '', strategy: 'preferred_source' }
        })
        return updated
      })
    }
    setPrefsSaved(false)
  }

  const handlePrefSourceChange = (tag, value) => {
    setSourcePrefs(prev => {
      const entry = prev[tag] || { source: '', strategy: 'preferred_source' }
      return { ...prev, [tag]: { ...entry, source: value } }
    })
    setPrefsSaved(false)
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      await Promise.all([api.updateBlockingConfig(config), api.updateSourcePreferences(sourcePrefs)])
      setSaved(true)
    } catch (e) { alert('Failed to save: ' + e.message) }
    setSaving(false)
  }

  if (loading) return <div className="loading"><div className="spinner" /> Loading config...</div>
  if (!config) return <div className="empty-state"><div className="empty-state-title">No blocking config found</div></div>

  const showTagsAndRules = config && config.tags && Object.keys(config.tags).length > 0

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Blocking Configuration</h1>
        <p className="page-description">Configure primary tag, review blocking rules, and adjust acceptable thresholds</p>
      </div>
      <div className="page-body">

        {/* ── Profile Mode Lock Banner ── */}
        {profileMode && (
          <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22 }}>🔐</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>Identity Graph Locked — Profile Mode Active</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                A complete customer profile was ingested from <strong style={{ color: 'var(--text-secondary)' }}>{profileModeInfo?.source || 'uploaded file'}</strong>.
                Blocking configuration and identity graph creation are disabled.
                Navigate to <strong style={{ color: 'var(--text-secondary)' }}>Audiences & Segments</strong> to build segments directly from the ingested profile.
              </div>
              <button
                onClick={() => fetch(`${API_BASE}/api/profile-mode`, { method: 'DELETE' }).then(() => { setProfileMode(false); setProfileModeInfo(null) })}
                style={{ marginTop: 10, background: 'none', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 5, color: '#a78bfa', fontSize: 11, cursor: 'pointer', padding: '5px 12px', fontFamily: 'inherit' }}>
                Clear Profile Mode &amp; Re-enable Identity Graph
              </button>
            </div>
          </div>
        )}

        {/* ── Data Governance Banner — trimmed ── */}
        <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>1P data only</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— 2P/3P sources are restricted to enrichment and excluded from identity resolution.</span>
          {firstPartySources.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginLeft: 8 }}>
              {firstPartySources.map(s => (
                <span key={s} style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 9999 }}>
                  {s.replace('.csv', '').replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Primary Tag Selector ── */}
        <div style={{ opacity: profileMode ? 0.35 : 1, pointerEvents: profileMode ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Primary Tag</span>
            <span className="card-subtitle">Select the primary matching field to auto-configure tags, weights, and blocking rules</span>
          </div>
          <div style={{ padding: '16px 16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ width: 200 }} value={primaryTag} onChange={e => setPrimaryTag(e.target.value)}>
              <option value="">-- Select Primary Tag --</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="device_id">Device ID</option>
            </select>
            <button className="btn btn-primary" disabled={!primaryTag} onClick={autoConfigure}>Auto-Configure</button>
            {configured && <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>✓ Configured</span>}
          </div>
        </div>

        {/* ── Tags & Comparison Methods ── */}
        {showTagsAndRules && (
          <div className="card mb-24">
            <SectionHeader title="Tags & Comparison Methods" collapsed={tagsCollapsed} onToggle={() => setTagsCollapsed(!tagsCollapsed)}
              badge={`${Object.keys(config.tags).filter(t => t !== 'zip').length} tags`} />
            {!tagsCollapsed && (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Tag</th><th>Comparison Method</th></tr></thead>
                  <tbody>
                    {Object.entries(config.tags).filter(([tag]) => tag !== 'zip').map(([tag, cfg]) => (
                      <tr key={tag}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{tag}</td>
                        <td>
                          <span style={{ display: 'inline-block', fontSize: 12, padding: '3px 10px', borderRadius: 12, background: cfg.comparison_method === 'exact' ? 'rgba(107,114,128,0.15)' : 'rgba(59,130,246,0.15)', color: cfg.comparison_method === 'exact' ? 'var(--text-secondary)' : '#3b82f6', fontWeight: 500 }}>
                            {methodLabel(cfg.comparison_method)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Blocking Rules ── */}
        {showTagsAndRules && config.blocking_rules && config.blocking_rules.length > 0 && (
          <div className="card mb-24">
            <SectionHeader title="Blocking Rules" subtitle={`${config.blocking_rules.filter(r => r.enabled).length} active rules`} collapsed={rulesCollapsed} onToggle={() => setRulesCollapsed(!rulesCollapsed)} />
            {!rulesCollapsed && (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>Status</th>
                      <th>Rule Name</th>
                      <th>Blocking Key Chain</th>
                      <th style={{ width: 120 }}>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.blocking_rules.map((rule, rIdx) => {
                      const ruleWeight = rule.chain.reduce((sum, item) => sum + (config.tags[item.tag]?.weight || 0), 0)
                      return (
                        <tr key={rIdx} style={{ opacity: rule.enabled ? 1 : 0.5 }}>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: rule.enabled ? '#22c55e' : '#6b7280' }} />
                          </td>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {rule.name.replace(/\s*\+\s*Zip\b/gi, '').replace(/^Zip\s*\+\s*/gi, '')}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {rule.chain.filter(item => item.tag !== 'zip').map((item, cIdx) => {
                                const tagWeight = config.tags[item.tag]?.weight
                                return (
                                  <span key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {cIdx > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 2px' }}>+</span>}
                                    <span style={{ display: 'inline-block', fontSize: 12, padding: '3px 10px', borderRadius: 12, background: 'rgba(0,102,204,0.12)', color: '#ffffff', fontWeight: 500 }}>
                                      {item.tag}
                                      {item.char_count && <span style={{ opacity: 0.6, marginLeft: 3 }}>({item.char_count}ch)</span>}
                                      {tagWeight != null && <span style={{ opacity: 0.5, marginLeft: 4, fontSize: 10 }}>w:{tagWeight}</span>}
                                    </span>
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: Math.max(ruleWeight * 1.2, 6), height: 8, borderRadius: 4, background: 'var(--accent)', maxWidth: 100 }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 24 }}>{ruleWeight}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Acceptable Threshold ── */}
        <div className="card mb-24">
          <SectionHeader title="Acceptable Threshold" subtitle="Adjust minimum score thresholds for each match tier" collapsed={thresholdCollapsed} onToggle={() => setThresholdCollapsed(!thresholdCollapsed)} />
          {!thresholdCollapsed && (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead><tr><th style={{ width: 120 }}>Tier</th><th>Min Score</th></tr></thead>
                <tbody>
                  {Object.entries(config.edge_tiers).sort(([, a], [, b]) => b.min_score - a.min_score).map(([tier, cfg]) => (
                    <tr key={tier}>
                      <td>
                        <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, padding: '4px 14px', borderRadius: 12, textTransform: 'capitalize', ...(TIER_STYLES[tier] || {}) }}>
                          {tier}
                        </span>
                      </td>
                      <td>
                        <div className="slider-group" style={{ maxWidth: 350 }}>
                          <input type="range" min="0" max="100" value={cfg.min_score} onChange={e => updateEdgeTier(tier, 'min_score', parseInt(e.target.value))} />
                          <span className="slider-value" style={{ fontSize: 14, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{cfg.min_score}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Preferred Data Source per Tag ── */}
        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Preferred Data Source per Tag</span>
          </div>
          <p style={{ padding: '0 16px', fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 16px' }}>
            Configure how each field is selected during golden record generation. Only 1P sources are eligible.
          </p>
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Strategy:</span>
              <select value={globalStrategy} onChange={e => handleGlobalStrategyChange(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 200 }}>
                {GLOBAL_STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {globalStrategy === 'preferred_source' && (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead><tr><th style={{ width: 100 }}>Tag</th><th>Preferred Source (1P only)</th></tr></thead>
                  <tbody>
                    {PREF_TAGS.map(tag => {
                      const entry = sourcePrefs[tag] || {}
                      const sources = (canonicalTagsSources[tag] || []).filter(s => {
                        const cls = classification[s]
                        return !cls || cls.party === '1P'
                      })
                      return (
                        <tr key={tag}>
                          <td>
                            <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontFamily: 'var(--font-mono)', textTransform: 'capitalize' }}>{tag}</span>
                          </td>
                          <td>
                            <select value={entry.source || ''} onChange={e => handlePrefSourceChange(tag, e.target.value)}
                              style={{ padding: '5px 10px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 220 }}>
                              <option value="">Any (auto-select)</option>
                              {sources.map(s => <option key={s} value={s}>{s.replace('.csv', '').replace(/_/g, ' ')}</option>)}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        </div>{/* end profile-mode disabled wrapper */}

        {/* ── Save ── */}
        <div className="flex gap-16" style={{ alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>{saving ? 'Saving...' : 'Save Configuration'}</button>
          {saved && <span style={{ color: 'var(--success)', fontSize: 13 }}>Configuration saved successfully</span>}
        </div>
      </div>
    </>
  )
}

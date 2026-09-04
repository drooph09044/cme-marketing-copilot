import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { readSelectedSourceSystem, SOURCE_SYSTEM_LABELS } from '../sourceSystem'

export default function PipelineOverview() {
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)
  const [sourceSystem, setSourceSystem] = useState(() => readSelectedSourceSystem())
  const intervalRef = useRef(null)

  const fetchSteps = () => {
    api.getSteps().then(setSteps).catch(() => {})
  }

  useEffect(() => {
    api.getSteps().then(s => { setSteps(s); setLoading(false) }).catch(() => setLoading(false))
    intervalRef.current = setInterval(fetchSteps, 3000)
    return () => clearInterval(intervalRef.current)
  }, [])

  useEffect(() => {
    const syncSourceSystem = () => {
      setSourceSystem(current => {
        const next = readSelectedSourceSystem()
        return current === next ? current : next
      })
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

  const runStep = async (id) => {
    await api.runStep(id, sourceSystem)
    fetchSteps()
  }

  const runAll = async () => {
    await api.runAll(sourceSystem)
    fetchSteps()
  }

  const getStepClass = (step) => {
    if (step.run_status === 'running') return 'running'
    if (step.run_status === 'error') return 'error'
    if (step.run_status === 'done' || step.outputs_ready) return 'done'
    return ''
  }

  const getLastRun = (step) => {
    if (step.run_status === 'running') return 'Running...'
    if (step.run_status === 'done') return 'Just now'
    if (step.log) return 'Completed'
    return '\u2014'
  }

  const anyRunning = steps.some(s => s.run_status === 'running')

  if (loading) return <div className="loading"><div className="spinner" /> Loading pipeline...</div>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Pipeline Overview</h1>
        <p className="page-description">Run and monitor the identity resolution pipeline</p>
      </div>
      <div className="page-body">
        <div className="flex-between mb-24">
          <button className="btn btn-primary" onClick={runAll} disabled={anyRunning}>
            {anyRunning ? 'Pipeline Running...' : 'Run Full Pipeline'}
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Source: {SOURCE_SYSTEM_LABELS[sourceSystem] || sourceSystem}
          </span>
        </div>

        <div className="card mb-24">
          <div className="card-header">
            <span className="card-title">Pipeline Steps</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Outputs Ready</th>
                  <th>Last Run</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {steps.map(step => (
                  <tr key={step.id}
                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => setSelectedLog(selectedLog === step.id ? null : step.id)}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{step.name}</td>
                    <td>
                      {step.outputs_ready ? (
                        <span style={{ color: 'var(--success)' }}>Yes</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>No</span>
                      )}
                    </td>
                    <td style={{ color: step.run_status === 'running' ? 'var(--accent-light)' : 'var(--text-secondary)', fontSize: 13 }}>
                      {getLastRun(step)}
                    </td>
                    <td><span className={`badge badge-${getStepClass(step) || 'idle'}`}>{step.run_status}</span></td>
                    <td>
                      <button className="btn btn-sm btn-secondary"
                        onClick={(e) => { e.stopPropagation(); runStep(step.id) }}
                        disabled={step.run_status === 'running'}>
                        {step.run_status === 'running' ? 'Running...' : 'Run'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedLog && (() => {
          const step = steps.find(s => s.id === selectedLog)
          return step && step.log ? (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Log: {step.name}</span>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedLog(null)}>Close</button>
              </div>
              <pre style={{
                background: 'var(--bg-secondary)',
                padding: 16,
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                maxHeight: 400,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}>{step.log}</pre>
            </div>
          ) : null
        })()}
      </div>
    </>
  )
}

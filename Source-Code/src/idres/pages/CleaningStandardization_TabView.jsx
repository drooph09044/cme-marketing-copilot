import React, { useEffect, useState } from 'react'
import CleaningStandardization_RulesView from './CleaningStandardization_RulesView'
import CleaningStandardization_ReportView from './CleaningStandardization_ReportView'

const TABS = [
  { key: 'rules', label: 'Rules' },
  { key: 'reporting', label: 'Reporting' },
]



export default function CleaningStandardization_TabView() {
  const [activeTab, setActiveTab] = useState("rules")



  return (
    <>
      {/* Optional: keep the same header outside tabs if you want a single shared header.
          If you want NO duplication, you can keep headers inside each tab component instead. */}

      <div className="page-header tab-mar">
        <h1 className="page-title">Cleaning &amp; Standardization</h1>
        <p className="page-description">
          Rules, examples, and reporting for cleaning &amp; standardization
        </p>

        {/* Tabs */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={`btn btn-sm ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mount only the active tab content */}
      <div className="page-body">
        {activeTab === 'rules' && <CleaningStandardization_RulesView />}
        {activeTab === 'reporting' && <CleaningStandardization_ReportView />}
      </div>
    </>
  )
}
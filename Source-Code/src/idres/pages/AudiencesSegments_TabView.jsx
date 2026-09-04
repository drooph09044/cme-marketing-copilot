import React, { useEffect, useState } from "react";

import AudiencesSegments_View from "./AudiencesSegments_View";
import AudiencesSegments_ViewReport from "./AudiencesSegments_ViewReport";

const TABS = [
  { key: "segments", label: "Audiences & Segments" },
  { key: "reporting", label: "Reporting" },
];



export default function AudiencesSegments_TabView({ onSendToJourneyBuilder }) {
  const [activeTab, setActiveTab] = useState("segments");



  return (
    <>
      <div className="page-header tab-mar">
        <h1 className="page-title">Audiences & Segments</h1>
        <p className="page-description">
          Pre-built segment library by industry · Create custom segments with consent enforcement
        </p>


        {/* Tabs */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`btn btn-sm ${activeTab === t.key ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {activeTab === "segments" && (
          <AudiencesSegments_View onSendToJourneyBuilder={onSendToJourneyBuilder} />
        )}
        {activeTab === "reporting" && <AudiencesSegments_ViewReport />}
      </div>
    </>
  );
}

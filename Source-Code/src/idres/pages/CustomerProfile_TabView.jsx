import React, { useEffect, useState } from "react";
import CustomerProfile_View from "./CustomerProfile_View";
import CustomerProfile_ReportView from "./CustomerProfile_ReportView";


const TABS = [
  { key: "profile", label: "Profile" },
  { key: "reporting", label: "Reporting" },
];



export default function CustomerProfile_TabView() {
  const [activeTab, setActiveTab] = useState("profile");


  return (
    <>
      <div className="page-header tab-mar">
        <div className="page-header" style={{ padding: 0, marginBottom: 20 }}>
        <div className="page-title">Customer Profile</div>
        <div className="page-description">Golden Records enriched with internal and external data sources</div>
        
      </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={`btn btn-sm ${activeTab === t.key ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {activeTab === "profile" && <CustomerProfile_View />}
        {activeTab === "reporting" && <CustomerProfile_ReportView />}
      </div>
    </>
  );
}
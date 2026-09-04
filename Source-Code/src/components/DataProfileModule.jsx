import { useId, useState } from "react";

export function DataProfileModule({ data }) {
  const uploadId = useId();
  const [csvName, setCsvName] = useState("");

  return (
    <section className="workspace-panel">
      <div className="workspace-head">
        <div>
          <div className="workspace-title">Data & Profile</div>
          <div className="workspace-copy">
            Manage connector readiness and local CSV ingestion sources that feed profile stitching and activation.
          </div>
        </div>
        <div className="workspace-pill-row">
          <span className="badge teal">{data.connectors.length} connectors</span>
          <span className="badge blue">Source inventory</span>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-accent" style={{ background: "#0FB8B8" }} />
        <div className="content-card-head">
          <div className="content-card-title">Connector Inventory</div>
          <span className="badge subtle">Production</span>
        </div>
        <div className="content-card-body">
          <div className="connector-grid">
            {data.connectors.map((connector) => (
              <div className="connector-card" key={connector.id}>
                <div className="connector-title-row">
                  <div className="content-card-title" style={{ color: connector.accent }}>
                    {connector.name}
                  </div>
                  <span className={`status-chip ${connector.id === "local" ? "warn" : "ok"}`}>{connector.status}</span>
                </div>
                <div className="helper-text">
                  {connector.type} / {connector.entities}
                </div>
                <div className="detail-row">
                  <span className="detail-key">freshness</span>
                  <span className="detail-value">{connector.freshness}</span>
                </div>

                {connector.id === "local" ? (
                  <div className="csv-upload-box">
                    <div className="field-label">Local CSV Upload</div>
                    <label className="button secondary small csv-upload-button" htmlFor={uploadId}>
                      Upload CSV
                    </label>
                    <input
                      id={uploadId}
                      className="csv-upload-input"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => setCsvName(event.target.files?.[0]?.name ?? "")}
                    />
                    <div className="helper-text">{csvName ? `Selected file: ${csvName}` : "Choose a CSV file to simulate a local data drop."}</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";

const API = "";

const S = {
  bgPrimary:   "var(--bg-primary)",
  bgSecondary: "var(--bg-secondary)",
  bgCard:      "var(--bg-card)",
  bgHover:     "var(--bg-card-hover)",
  border:      "var(--border)",
  borderLight: "var(--border-light)",
  textPrimary: "var(--text-primary)",
  textSecondary:"var(--text-secondary)",
  textMuted:   "var(--text-muted)",
  accent:      "var(--accent)",
  accentLight: "var(--accent-light)",
  success:     "#10b981",
  warning:     "#f59e0b",
  error:       "#ef4444",
};

const STEPS = [
  { key: "ground_truth",  label: "Ground Truth",       icon: "🎯", color: "#8b5cf6" },
  { key: "raw_source",    label: "Raw Source",          icon: "📂", color: "#f59e0b" },
  { key: "preprocessed",  label: "Preprocessed",        icon: "🔧", color: "#06b6d4" },
  { key: "standardized",  label: "Standardized",        icon: "✏️", color: "#3b82f6" },
  { key: "candidate_pairs",label: "Candidate Pairs",    icon: "🔗", color: "#f97316" },
  { key: "cluster",       label: "Cluster",             icon: "🧩", color: "#10b981" },
  { key: "golden_record", label: "Golden Record",       icon: "⭐", color: "#eab308" },
];

function Badge({ label, color }) {
  return (
    <span style={{ background: `${color}20`, color, border: `1px solid ${color}40`, padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>
      {label}
    </span>
  );
}

function StepNode({ step, active, done, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", opacity: done || active ? 1 : 0.4, transition: "all 0.2s" }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        background: active ? step.color : done ? `${step.color}30` : S.bgSecondary,
        border: `2px solid ${active || done ? step.color : S.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, boxShadow: active ? `0 0 16px ${step.color}60` : "none",
        transition: "all 0.2s",
      }}>
        {step.icon}
      </div>
      <div style={{ fontSize: 9, fontWeight: 600, color: active ? step.color : S.textMuted, textAlign: "center", maxWidth: 64 }}>
        {step.label}
      </div>
    </div>
  );
}

function FieldRow({ label, value, mono, highlight }) {
  if (!value && value !== 0) return null;
  const display = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: `1px solid ${S.border}` }}>
      <span style={{ fontSize: 11, color: S.textMuted, minWidth: 160, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 11, color: highlight ? S.success : S.textPrimary,
        fontFamily: mono ? "monospace" : "inherit",
        fontWeight: highlight ? 700 : 400,
        wordBreak: "break-all",
      }}>{display}</span>
    </div>
  );
}

function StepDetail({ stepKey, data, color }) {
  if (!data) return (
    <div style={{ padding: 24, textAlign: "center", color: S.textMuted, fontSize: 13 }}>
      No data found for this step
    </div>
  );

  // Ground Truth
  if (stepKey === "ground_truth") {
    return (
      <div style={{ padding: 16 }}>
        <FieldRow label="Customer ID" value={data.customer_id} highlight />
        <FieldRow label="Total Records" value={data.total_records} />
        {data.sibling_records?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 8, fontWeight: 600 }}>Sibling Records ({data.sibling_records.length})</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {data.sibling_records.map(r => (
                <span key={r} style={{ background: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.25)", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }}>{r}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Raw Source
  if (stepKey === "raw_source") {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <Badge label={data.source_file || "Unknown source"} color={color} />
        </div>
        {data.data && Object.entries(data.data).map(([k, v]) => (
          <FieldRow key={k} label={k} value={v} mono={k.includes("id") || k.includes("email")} />
        ))}
      </div>
    );
  }

  // Candidate Pairs
  if (stepKey === "candidate_pairs") {
    const pairs = Array.isArray(data) ? data : (data.pairs || []);
    if (!pairs.length) return <div style={{ padding: 16, color: S.textMuted, fontSize: 13 }}>No candidate pairs found</div>;
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: S.textMuted, marginBottom: 12 }}>{pairs.length} pairs found</div>
        {pairs.slice(0, 10).map((p, i) => (
          <div key={i} style={{ background: S.bgSecondary, border: `1px solid ${S.border}`, borderRadius: 6, padding: "8px 12px", marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: S.accentLight }}>{p.record_id_1}</span>
                <span style={{ color: S.textMuted }}>↔</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: S.accentLight }}>{p.record_id_2}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Badge label={p.edge_type || "weak"} color={p.edge_type === "exact" ? S.success : p.edge_type === "strong" ? S.accent : S.warning} />
                <span style={{ fontSize: 11, fontWeight: 700, color: S.textPrimary }}>Score: {p.score}</span>
              </div>
            </div>
            {p.matched_fields && (
              <div style={{ fontSize: 10, color: S.textMuted }}>Matched: {p.matched_fields}</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Cluster
  if (stepKey === "cluster") {
    return (
      <div style={{ padding: 16 }}>
        <FieldRow label="Cluster ID"  value={data.cluster_id} mono highlight />
        <FieldRow label="Golden ID"   value={data.golden_id}  mono highlight />
        <FieldRow label="Cluster Size" value={data.cluster_size} />
        {data.cluster_members?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: S.textMuted, marginBottom: 8, fontWeight: 600 }}>Cluster Members ({data.cluster_members.length})</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {data.cluster_members.slice(0, 20).map(r => (
                <span key={r} style={{ background: "rgba(16,185,129,0.1)", color: S.success, border: "1px solid rgba(16,185,129,0.25)", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }}>{r}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Golden Record
  if (stepKey === "golden_record") {
    const important = ["golden_id", "full_name", "email", "phone", "address", "subscription_tier", "household_id", "record_count", "source_files"];
    const d = data.data || data;
    return (
      <div style={{ padding: 16 }}>
        {important.map(k => d[k] !== undefined && (
          <FieldRow key={k} label={k} value={d[k]} mono={k.includes("id") || k.includes("email")} highlight={k === "golden_id"} />
        ))}
        {d.all_emails && <FieldRow label="all_emails" value={d.all_emails} />}
        {d.all_phones && <FieldRow label="all_phones" value={d.all_phones} />}
        {d.diversity_score !== undefined && <FieldRow label="diversity_score" value={d.diversity_score} />}
      </div>
    );
  }

  // Generic (preprocessed, standardized)
  const obj = typeof data === "object" && !Array.isArray(data) ? data : {};
  return (
    <div style={{ padding: 16 }}>
      {Object.entries(obj).map(([k, v]) => (
        <FieldRow key={k} label={k} value={v} mono={k.includes("id") || k.includes("email")} />
      ))}
    </div>
  );
}

export default function RecordTrace() {
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [traceData,  setTraceData]  = useState(null);
  const [error,      setError]      = useState("");
  const [activeStep, setActiveStep] = useState(null);

  const runTrace = async () => {
    const id = input.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setError("");
    setTraceData(null);
    setActiveStep(null);
    try {
      const res = await fetch(`${API}/api/trace/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTraceData(d);
      // Auto-select first available step
      const first = STEPS.find(s => d.steps?.[s.key]);
      if (first) setActiveStep(first.key);
    } catch (e) {
      setError(`Could not trace record: ${e.message}`);
    }
    setLoading(false);
  };

  const steps = traceData?.steps || {};
  const availableSteps = STEPS.filter(s => steps[s.key]);
  const activeStepObj = STEPS.find(s => s.key === activeStep);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Record Trace</h1>
        <p className="page-description">Trace any record through every stage of the identity resolution pipeline</p>
      </div>

      <div className="page-body">
        {/* Search */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24, maxWidth: 600 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && runTrace()}
            placeholder="e.g. SB-000001, SA-000042, AE-000100"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 6, border: `1px solid ${S.border}`, background: S.bgSecondary, color: S.textPrimary, fontSize: 13, outline: "none", fontFamily: "inherit" }}
          />
          <button onClick={runTrace} disabled={loading || !input.trim()}
            style={{ padding: "10px 20px", background: loading ? S.bgCard : S.accent, color: loading ? S.textMuted : "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {loading ? "Tracing..." : "Trace Record"}
          </button>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "12px 16px", color: S.error, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: S.textMuted }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${S.border}`, borderTop: `3px solid ${S.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            Tracing record through pipeline...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {traceData && (
          <>
            {/* Record summary */}
            <div style={{ background: S.bgCard, border: `1px solid ${S.borderLight}`, borderRadius: 10, padding: "14px 20px", marginBottom: 24, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: S.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Record ID</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: S.accentLight, fontFamily: "monospace" }}>{traceData.record_id}</div>
              </div>
              {steps.cluster?.golden_id && (
                <div>
                  <div style={{ fontSize: 10, color: S.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Golden ID</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: S.success, fontFamily: "monospace" }}>{steps.cluster.golden_id}</div>
                </div>
              )}
              {steps.cluster?.cluster_id && (
                <div>
                  <div style={{ fontSize: 10, color: S.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cluster ID</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.warning, fontFamily: "monospace" }}>{steps.cluster.cluster_id}</div>
                </div>
              )}
              {steps.ground_truth?.customer_id && (
                <div>
                  <div style={{ fontSize: 10, color: S.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Customer ID</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#8b5cf6", fontFamily: "monospace" }}>{steps.ground_truth.customer_id}</div>
                </div>
              )}
              {steps.raw_source?.source_file && (
                <div>
                  <div style={{ fontSize: 10, color: S.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Source</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: S.textSecondary }}>{steps.raw_source.source_file}</div>
                </div>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {availableSteps.map(s => (
                  <div key={s.key} style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} title={s.label} />
                ))}
                <span style={{ fontSize: 11, color: S.textMuted, marginLeft: 4 }}>{availableSteps.length}/{STEPS.length} steps found</span>
              </div>
            </div>

            {/* Pipeline flow */}
            <div style={{ background: S.bgCard, border: `1px solid ${S.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 0, justifyContent: "center", flexWrap: "wrap", rowGap: 16 }}>
                {STEPS.map((step, i) => (
                  <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                    <StepNode
                      step={step}
                      active={activeStep === step.key}
                      done={!!steps[step.key]}
                      onClick={() => steps[step.key] && setActiveStep(step.key)}
                    />
                    {i < STEPS.length - 1 && (
                      <div style={{ width: 32, height: 2, background: steps[STEPS[i+1]?.key] ? S.accent : S.border, margin: "0 4px", marginBottom: 20, transition: "background 0.3s" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step detail */}
            {activeStepObj && (
              <div style={{ background: S.bgCard, border: `1px solid ${activeStepObj.color}40`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", background: `${activeStepObj.color}15`, borderBottom: `1px solid ${activeStepObj.color}30`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{activeStepObj.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: activeStepObj.color }}>{activeStepObj.label}</span>
                  <span style={{ fontSize: 11, color: S.textMuted, marginLeft: 4 }}>— click any step above to inspect</span>
                </div>
                <StepDetail
                  stepKey={activeStep}
                  data={steps[activeStep]}
                  color={activeStepObj.color}
                />
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!traceData && !loading && !error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: S.textMuted }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: S.textSecondary, marginBottom: 8 }}>Enter a Record ID to trace</div>
            <div style={{ fontSize: 13 }}>Accepts raw source record IDs: SB-000001, SA-000042, AE-000100, CS-000001, EE-000001</div>
          </div>
        )}
      </div>
    </>
  );
}

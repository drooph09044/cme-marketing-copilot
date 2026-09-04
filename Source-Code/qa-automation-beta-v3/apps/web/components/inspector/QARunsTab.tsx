"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { TestPlan, TestSuite, CohortProfile, SimulationResult, SimulationCheck, SimSummary } from "@/lib/types";

interface Props {
  testPlans: TestPlan[];
  activePlanId: string | null;
  onSelectPlan: (id: string) => void;
  synthRunning: boolean;
  onExtend: (instruction: string, count: number) => void;
  extendError: string | null;
  clearExtendError: () => void;
  /** Surfaces the selected profile's visited journey nodes so the canvas can highlight them. */
  onPathChange: (nodeIds: string[]) => void;
  /** Surfaces a compact simulation summary so the canvas can show it in a corner. */
  onSimResult: (summary: SimSummary | null) => void;
}

// Overall run verdict is binary.
type Verdict = "pass" | "fail";
const V_BG: Record<Verdict, string> = { pass: "var(--ok)", fail: "var(--danger)" };
const V_LABEL: Record<Verdict, string> = { pass: "PASS", fail: "FAIL" };

// A test case / step is PASS, FAIL, or SKIPPED ("did not execute").
type CaseStatus = "pass" | "fail" | "skipped";
const C_BG: Record<CaseStatus, string> = {
  pass: "var(--ok)", fail: "var(--danger)", skipped: "var(--muted, #8a8f98)",
};
const C_LABEL: Record<CaseStatus, string> = {
  pass: "PASS", fail: "FAIL", skipped: "DID NOT EXECUTE",
};
const C_SHORT: Record<CaseStatus, string> = { pass: "P", fail: "F", skipped: "—" };
const C_MARK: Record<CaseStatus, string> = { pass: "OK", fail: "✕", skipped: "—" };

// Map a profile to its grouping bucket (drives the grouped list + filters).
// The three suppression reasons each get their own bucket.
function bucketOf(p: CohortProfile): string {
  const a = (p.archetype ?? "").toLowerCase();
  const reason = p.suppressionReason;
  if (reason === "holdout_segment" || p.holdout || a === "holdout") return "Holdout";
  if (reason === "no_consent" || a === "consent_suppressed") return "No consent";
  if (reason === "experiment_holdback" || a === "experiment_holdback") return "Experiment holdback";
  if (a === "ineligible" || p.category === "ineligible") return "Ineligible";
  if (a.startsWith("experiment_variant") || p.scenarioTone === "variant") return "Experiment";
  return "Eligible";
}
const BUCKET_ORDER = ["Eligible", "Experiment", "Holdout", "No consent", "Experiment holdback", "Ineligible"];
const BUCKET_TONE: Record<string, string> = {
  Eligible: "eligible", Experiment: "variant",
  Holdout: "excluded", "No consent": "excluded", "Experiment holdback": "excluded", Ineligible: "excluded",
};

// A short consent-scope label for the profile cards / metadata.
function consentLabel(p: CohortProfile): string {
  if (p.consentScope === "global" || p.globalConsent) return "Global consent";
  if (p.consentScope === "none") return "No consent";
  const cc = p.channelConsent ?? {};
  const on = (["email", "sms", "push", "call"] as const).filter((k) => cc[k]);
  if (on.length > 0) return `Consent: ${on.join(", ")}`;
  if (p.consent === false) return "No consent";
  return "Consent: global";
}

export default function QARunsTab({
  testPlans, activePlanId, onSelectPlan, synthRunning,
  onExtend, extendError, clearExtendError, onPathChange, onSimResult,
}: Props) {
  const activePlan = useMemo(
    () => testPlans.find((p) => p.id === activePlanId) ?? testPlans[testPlans.length - 1] ?? null,
    [testPlans, activePlanId],
  );
  const profiles = activePlan?.profiles ?? [];
  const suites = activePlan?.suites ?? [];

  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SimulationResult>>({});
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [instruction, setInstruction] = useState("");

  const toggleSuite = (name: string) =>
    setExpandedSuites((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const submitExtend = () => {
    const text = instruction.trim();
    if (!text || synthRunning) return;
    clearExtendError(); onExtend(text, 0); setInstruction("");
  };

  // Group profiles into buckets (ordered), then filter.
  const groups = useMemo(() => {
    const m = new Map<string, CohortProfile[]>();
    for (const p of profiles) {
      const b = bucketOf(p);
      if (!m.has(b)) m.set(b, []);
      m.get(b)!.push(p);
    }
    const ordered = [...BUCKET_ORDER.filter((b) => m.has(b)), ...[...m.keys()].filter((b) => !BUCKET_ORDER.includes(b))];
    return ordered.map((b) => [b, m.get(b)!] as [string, CohortProfile[]]);
  }, [profiles]);

  const filterDefs = useMemo<Array<[string, string]>>(
    () => [["all", "All"], ...groups.map(([b, list]) => [b, `${b} (${list.length})`] as [string, string])],
    [groups],
  );
  const visibleGroups = filter === "all" ? groups : groups.filter(([b]) => b === filter);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;
  const selectedResult = selectedId ? results[selectedId] : undefined;

  // Surface the selected profile's visited nodes + a compact summary so the
  // canvas can highlight the path and show results in a corner.
  useEffect(() => {
    onPathChange((selectedResult?.path ?? []).map((s) => s.nodeId));
    if (!selected || !selectedResult) { onSimResult(null); return; }
    const checks = selectedResult.checks ?? [];
    const tally = (st: CaseStatus) => checks.filter((c) => c.status === st).length;
    const path = selectedResult.path ?? [];
    const stopped = path.some((s) => s.action === "suppressed" || s.action === "converted")
      || tally("skipped") > 0;
    onSimResult({
      profileId: selected.id,
      profileName: selected.name ?? selected.id,
      verdict: selectedResult.verdict,
      pass: tally("pass"),
      fail: tally("fail"),
      skipped: tally("skipped"),
      total: checks.length,
      steps: path.length,
      stopped,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResult, selectedId]);

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  // Checks grouped by suite (order preserved) so we can align test cases robustly.
  const checksBySuite = useMemo(() => {
    const m = new Map<string, SimulationCheck[]>();
    for (const c of selectedResult?.checks ?? []) {
      const key = norm(c.suite ?? "");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResult]);

  // Match a test case to its check: exact title → normalized title → positional.
  function caseStatusFor(suiteName: string, caseTitle: string, idx: number): CaseStatus | undefined {
    const checks = checksBySuite.get(norm(suiteName)) ?? [];
    if (checks.length === 0) return undefined;
    const exact = checks.find((c) => c.title === caseTitle);
    if (exact) return exact.status;
    const fuzzy = checks.find((c) => norm(c.title) === norm(caseTitle));
    if (fuzzy) return fuzzy.status;
    return checks[idx]?.status; // fall back to position within the suite
  }

  // Suite status for the selected profile: FAIL if any case failed, else PASS if
  // any executed, else SKIPPED (the whole suite did not execute).
  function suiteStatus(s: TestSuite): CaseStatus | null {
    const checks = checksBySuite.get(norm(s.name)) ?? [];
    if (checks.length === 0) return null;
    if (checks.some((c) => c.status === "fail")) return "fail";
    if (checks.some((c) => c.status === "pass")) return "pass";
    return "skipped";
  }

  async function simulate(profile: CohortProfile) {
    if (!activePlan || running.has(profile.id)) return;
    setRunning((s) => new Set(s).add(profile.id));
    try {
      const result = await api.simulateProfile({
        journeyId: activePlan.journeyId, segmentId: activePlan.segmentId, profile, suites,
      });
      setResults((r) => ({ ...r, [profile.id]: result }));
    } catch (e) { console.error("Simulation failed", e); }
    finally { setRunning((s) => { const n = new Set(s); n.delete(profile.id); return n; }); }
  }
  function selectProfile(profile: CohortProfile) {
    setSelectedId(profile.id);
    if (!results[profile.id] && !running.has(profile.id)) simulate(profile);
  }
  async function runAll() {
    for (const p of profiles) {
      if (!results[p.id] && !running.has(p.id)) await simulate(p); // sequential — rate limits
    }
  }

  const planHistory = testPlans.length > 1 && (
    <div className="qa-plan-history">
      <span className="qa-plan-history__label">Versions:</span>
      {testPlans.map((plan, idx) => (
        <button key={plan.id} type="button"
          className={`qa-plan-pill ${plan.id === activePlan?.id ? "is-active" : ""}`}
          onClick={() => { onSelectPlan(plan.id); setSelectedId(null); }}
          title={`${plan.segmentId} · ${plan.profiles.length} profiles · ${plan.createdAt}`}
        >v{idx + 1}</button>
      ))}
    </div>
  );

  if (synthRunning) {
    return (
      <div className="jo-pane qa-wb-wrap">
        <div className="qa-running-state">
          <div className="qa-running-state__spinner" />
          <div className="qa-running-state__title">Generating profiles & QA suites…</div>
          <p>Synthesising a realistic audience and the journey-level QA suites.</p>
        </div>
      </div>
    );
  }
  if (!activePlan || profiles.length === 0) {
    return (
      <div className="jo-pane qa-wb-wrap">
        {planHistory}
        <div className="qa-empty">
          <div className="qa-empty__title">No profiles yet</div>
          <p>Select a journey + segment, then click <strong>Generate Profiles &amp; Suites</strong>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="qa-wb-wrap">
      {planHistory}
      <div className="qa-wb">
        {/* ── Column 1: Profiles (grouped) ──────────────────────────── */}
        <section className="qa-wb__col">
          <div className="qa-wb__head">
            <h3>Profiles</h3>
            <span className="qa-wb__count">{profiles.length}</span>
          </div>
          <div className="qa-wb__filters">
            {filterDefs.map(([key, label]) => (
              <button key={key} type="button"
                className={`qa-chip-btn${filter === key ? " is-on" : ""}`}
                onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <div className="qa-wb__scroll">
            {visibleGroups.map(([bucket, list]) => (
              <div key={bucket} className="qa-pgroup">
                <div className="qa-pgroup__head">
                  <span className={`qa-pgroup__dot qa-pgroup__dot--${BUCKET_TONE[bucket] ?? "eligible"}`} />
                  {bucket} <span className="qa-pgroup__count">{list.length}</span>
                </div>
                {list.map((p) => {
                  const r = results[p.id];
                  const isRunning = running.has(p.id);
                  return (
                    <button key={p.id} type="button"
                      className={`qa-pcard${selectedId === p.id ? " is-active" : ""}`}
                      onClick={() => selectProfile(p)}>
                      <span className="qa-pcard__avatar">{p.initials ?? (p.name ?? "?").slice(0, 2).toUpperCase()}</span>
                      <span className="qa-pcard__body">
                        <span className="qa-pcard__top">
                          <span className="qa-pcard__name">{p.name ?? p.id}</span>
                          {isRunning ? <span className="qa-pcard__spin" />
                            : r ? <span className="qa-pcard__verdict" style={{ color: V_BG[r.verdict] }}>{V_LABEL[r.verdict]}</span> : null}
                        </span>
                        <span className="qa-pcard__sub">{p.summary ?? p.archetype} · {p.id}</span>
                        {p.scenarioTag && (
                          <span className={`qa-tagchip qa-tagchip--${p.scenarioTone ?? "eligible"}`}>{p.scenarioTag}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {/* Add profiles via prompt → new version */}
          <div className="qa-addbar">
            <textarea className="qa-addbar__input" rows={2}
              placeholder="Add profiles… e.g. '3 high-mileage owners with an open service case'"
              value={instruction} disabled={synthRunning}
              onChange={(e) => { setInstruction(e.target.value); if (extendError) clearExtendError(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitExtend(); }} />
            {extendError && <div className="qa-addbar__err">{extendError}</div>}
            <button type="button" className="jo-btn jo-btn--ghost qa-addbar__btn"
              disabled={!instruction.trim() || synthRunning} onClick={submitExtend}>
              {synthRunning ? "Adding…" : "Add profiles (new version)"}
            </button>
          </div>
        </section>

        {/* ── Column 2: QA Suites (per selected profile) ────────────── */}
        <section className="qa-wb__col">
          <div className="qa-wb__head">
            <h3>QA Suites</h3>
            <button type="button" className="jo-btn jo-btn--primary qa-wb__runall" onClick={runAll}>Run All</button>
          </div>
          {selected && (
            <div className="qa-wb__subhead">Results for <strong>{selected.name}</strong></div>
          )}
          <div className="qa-wb__scroll">
            {suites.map((s) => {
              const cases = s.testCases ?? [];
              const count = cases.length || (s.testCount ?? 0);
              const st = suiteStatus(s);
              const open = expandedSuites.has(s.name);
              return (
                <div key={s.name} className={`qa-scard${open ? " is-open" : ""}`}>
                  <button type="button" className="qa-scard__head"
                    onClick={() => toggleSuite(s.name)} aria-expanded={open}>
                    <span className="qa-scard__status"
                      title={st ? C_LABEL[st] : undefined}
                      style={st ? { background: C_BG[st], color: "#fff", borderColor: "transparent" } : undefined}>
                      {st ? C_SHORT[st] : "--"}
                    </span>
                    <div className="qa-scard__body">
                      <div className="qa-scard__name">{s.name}</div>
                      <div className="qa-scard__desc">{s.description}</div>
                      <div className="qa-scard__meta">{count} test{count === 1 ? "" : "s"}</div>
                    </div>
                    <span className="qa-scard__chev">{open ? "▾" : "▸"}</span>
                  </button>
                  {open && (
                    cases.length > 0 ? (
                      <ul className="qa-tcase-list">
                        {cases.map((tc, i) => {
                          const cs = caseStatusFor(s.name, tc.title, i);
                          return (
                            <li key={i} className={`qa-tcase${cs ? ` qa-tcase--${cs}` : ""}`}>
                              <span className="qa-tcase__badge"
                                style={cs ? { background: C_BG[cs], color: "#fff", borderColor: "transparent" } : undefined}>
                                {cs ? C_LABEL[cs] : "—"}
                              </span>
                              <div className="qa-tcase__body">
                                <div className="qa-tcase__title">{tc.title}</div>
                                {tc.description && <div className="qa-tcase__desc">{tc.description}</div>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="qa-tcase-empty">No individual test cases — regenerate the plan to populate them.</div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Column 3: Simulation Results ──────────────────────────── */}
        <section className="qa-wb__col qa-wb__col--results">
          <div className="qa-wb__head">
            <h3>Simulation Results</h3>
            {selected && <span className="qa-wb__chip">{selected.name} / {selected.id}</span>}
          </div>
          <div className="qa-wb__scroll">
            {!selected ? (
              <div className="qa-empty"><p>Select a profile to simulate its journey.</p></div>
            ) : (
              <>
                <div className="qa-meta-grid">
                  {(selected.metadata ?? []).map((m) => (
                    <div key={m.label} className="qa-meta-card">
                      <div className="qa-meta-card__label">{m.label}</div>
                      <div className="qa-meta-card__value">{m.value}</div>
                    </div>
                  ))}
                  <div className="qa-meta-card">
                    <div className="qa-meta-card__label">Consent</div>
                    <div className="qa-meta-card__value">{consentLabel(selected)}</div>
                  </div>
                  {selected.suppressionReason && (
                    <div className="qa-meta-card">
                      <div className="qa-meta-card__label">Suppressed</div>
                      <div className="qa-meta-card__value">{selected.suppressionReason.replace(/_/g, " ")}</div>
                    </div>
                  )}
                  {selected.ownerId && (
                    <div className="qa-meta-card">
                      <div className="qa-meta-card__label">Owner ID</div>
                      <div className="qa-meta-card__value">{selected.ownerId}</div>
                    </div>
                  )}
                </div>
                {(selected.expectedOutcome || selectedResult?.expected) && (
                  <div className="qa-expected">Expected: <strong>{selectedResult?.expected ?? selected.expectedOutcome}</strong></div>
                )}

                {/* Journey path — the nodes/steps this profile actually took */}
                {selectedResult?.path && selectedResult.path.length > 0 && (
                  <>
                    <div className="qa-sim-head">Journey Path</div>
                    <ol className="qa-path">
                      {selectedResult.path.map((step, i) => (
                        <li key={i} className={`qa-path__step qa-path__step--${step.status}`}>
                          <span className="qa-path__num">{i + 1}</span>
                          <span className="qa-path__dot" style={{ background: C_BG[step.status] }} />
                          <div className="qa-path__body">
                            <div className="qa-path__label">{step.label || step.nodeId}</div>
                            {step.action && <div className="qa-path__action">{step.action}</div>}
                          </div>
                          <code className="qa-path__node">{step.nodeId}</code>
                        </li>
                      ))}
                    </ol>
                  </>
                )}

                <div className="qa-sim-head">Test Results</div>
                {running.has(selected.id) && !selectedResult ? (
                  <div className="qa-sim-loading"><span className="qa-running-state__spinner" /><span>Simulating {selected.name}…</span></div>
                ) : selectedResult ? (
                  suites.map((s) => {
                    const checks = selectedResult.checks.filter((c) => c.suite === s.name);
                    if (checks.length === 0) return null;
                    return (
                      <div key={s.name} className="qa-simgroup">
                        <div className="qa-simgroup__head">{s.name}</div>
                        <ul className="qa-checks">
                          {checks.map((c, i) => (
                            <li key={i} className={`qa-check qa-check--${c.status}`}>
                              <span className="qa-check__ok" style={{ background: C_BG[c.status] }}>{C_MARK[c.status]}</span>
                              <div className="qa-check__body">
                                <div className="qa-check__title">{c.title}</div>
                                <div className="qa-check__desc">{c.description}</div>
                              </div>
                              <span className={`qa-check__verdict qa-check__verdict--${c.status}`}>{C_LABEL[c.status]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
                ) : (
                  <div className="qa-empty"><p>Click the profile again to run its simulation.</p></div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

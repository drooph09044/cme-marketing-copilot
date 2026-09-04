import { useMemo, useState } from "react";
import { calcHoldoutAudience, formatChannelState } from "../../shared/suiteData";
import EmbeddedQAApp from "../qaAutomation/components/EmbeddedQAApp";

const TAB_IDS = [
  { id: "audience", label: "Audience Config" },
  { id: "canvas", label: "Journey Canvas" },
  { id: "measurement", label: "Measurement" },
  { id: "qa", label: "QA" },
  { id: "json", label: "JSON Export" },
];

function StatusChips() {
  const chips = [
    { label: "Brief parsed", tone: "ok" },
    { label: "Schema validated", tone: "ok" },
    { label: "Audience ready", tone: "ok" },
    { label: "Canvas generated", tone: "ok" },
    { label: "SMS not configured", tone: "warn" },
  ];

  return (
    <div className="chip-row">
      {chips.map((chip) => (
        <span key={chip.label} className={`status-chip ${chip.tone}`}>
          {chip.label}
        </span>
      ))}
    </div>
  );
}
function ConfigCard({ accent, title, badge, children }) {
  return (
    <div className="content-card">
      <div className="content-card-accent" style={{ background: accent }} />
      <div className="content-card-head">
        <div className="content-card-title">{title}</div>
        {badge ? <span className="badge">{badge}</span> : null}
      </div>
      <div className="content-card-body">{children}</div>
    </div>
  );
}

function displayChannel(channel) {
  if (channel === "inApp") {
    return "In-App";
  }
  return String(channel ?? "email")
    .trim()
    .toUpperCase();
}

function CanvasPreview({ orchestrationType = "journey", singleChannel = "email", singleUseHoldout = true, singleUseAB = true }) {
  const nodes =
    orchestrationType === "single-touchpoint"
      ? [
          "Entry",
          ...(singleUseHoldout ? ["Holdout"] : []),
          ...(singleUseAB ? ["A/B"] : []),
          displayChannel(singleChannel),
          "Outcome",
          "Exit",
        ]
      : ["Entry", "Holdout", "A/B", "Wait", "Email", "Cond", "Wait", "Push", "Exit"];
  return (
    <div className="canvas-preview">
      {nodes.map((node, index) => (
        <div className="canvas-preview-step" key={node}>
          <div className="canvas-preview-box">{node}</div>
          {index < nodes.length - 1 ? <div className="canvas-preview-arrow">-</div> : null}
        </div>
      ))}
    </div>
  );
}


function platformSendLabel(platform) {
  if (platform === "Braze") {
    return "Send to Braze";
  }
  if (platform === "SFMC") {
    return "Send to SFMC";
  }
  return "Send to AJO";
}

function platformSentLabel(platform) {
  if (platform === "Braze") {
    return "Sent to Braze";
  }
  if (platform === "SFMC") {
    return "Sent to SFMC";
  }
  return "Sent to AJO";
}

export function JourneyConfigModule({
  data,
  form,
  tab,
  busy,
  progress,
  platform,
  orchestrationType = "journey",
  singleTouchpoint = null,
  sendState,
  showActivationCard = false,
  journeyId = null,
  onTabChange,
  onFormChange,
  onToggleChannel,
  onGenerate,
  onSend,
  onActivate,
}) {
  const [copied, setCopied] = useState(false);
  const durationOptions = Array.from(new Set(["21 days", "14 days", "30 days", form.duration].filter(Boolean)));
  const frequencyOptions = Array.from(
    new Set(["Max 3 per week", "Max 2 per week", "Max 1 per week", form.frequencyCap].filter(Boolean)),
  );
  const isSingleTouchpoint = orchestrationType === "single-touchpoint";
  const singleChannel = singleTouchpoint?.singleChannel ?? "email";
  const singleChannelLabel = displayChannel(singleChannel);
  const singleUseHoldout = isSingleTouchpoint ? Boolean(singleTouchpoint?.singleUseHoldout) && Number(form.holdout) > 0 : true;
  const singleUseAB = isSingleTouchpoint ? Boolean(singleTouchpoint?.singleUseAB) : true;
  const sendOffsetHours = Number(singleTouchpoint?.singleSendOffsetHours ?? 0);
  const outcomeWindowHours = Number(singleTouchpoint?.singleOutcomeWindowHours ?? 24);

  const holdoutCount = singleUseHoldout ? calcHoldoutAudience(form.holdout) : 0;
  const activeChannels = isSingleTouchpoint ? singleChannelLabel : formatChannelState(form.channels);
  const journeyName = `LAC_${form.name.replace(/[^a-z0-9]+/gi, "_")}`.replace(/_+/g, "_");

  const payload = useMemo(
    () => ({
      platform,
      name: journeyName,
      orchestration: {
        type: isSingleTouchpoint ? "single-touchpoint" : "journey",
        ...(isSingleTouchpoint
          ? {
              singleChannel,
              triggerType: singleTouchpoint?.singleTriggerType ?? "event",
              trigger: singleTouchpoint?.singleTriggerEvent ?? "audienceQualified",
              sendOffsetHours,
              outcomeWindowHours,
            }
          : {}),
      },
      objective: form.objective,
      audience: {
        segmentName: form.audience,
        entryTrigger: form.entryTrigger,
        exclusions: [`holdout_${form.holdout}pct`, "marketing_opt_out", "active_journey"],
      },
      channels: isSingleTouchpoint
        ? [singleChannel]
        : Object.entries(form.channels)
            .filter(([, enabled]) => enabled)
            .map(([channel]) => channel),
      holdout: singleUseHoldout
        ? {
            percentage: Number(form.holdout),
            segmentName: `Holdout_${form.holdout}pct`,
          }
        : { enabled: false },
      experiment: singleUseAB
        ? {
            variants: [
              { id: "VarA", label: form.variantA, percentage: Number(form.split) },
              { id: "VarB", label: form.variantB, percentage: 100 - Number(form.split) },
            ],
          }
        : { enabled: false, variants: [{ id: "VarA", label: form.variantA, percentage: 100 }] },
      timing: {
        duration: form.duration,
        frequencyCap: form.frequencyCap,
      },
      measurement: {
        attribution: form.attribution,
        workspaceName: `${journeyName}_Measurement`,
      },
    }),
    [form, isSingleTouchpoint, journeyName, outcomeWindowHours, platform, sendOffsetHours, singleChannel, singleTouchpoint?.singleTriggerEvent, singleTouchpoint?.singleTriggerType, singleUseAB, singleUseHoldout],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (_error) {
      setCopied(false);
    }
  }

  return (
    <section className="module-layout config-layout">
      <aside className="panel side-panel wide">
        <div className="panel-head">
          <div className="panel-title" style={{ color: "#4A9EF5" }}>
            Journey Config
          </div>
          <div className="panel-subtitle">
            Tune audience, channels, experiment controls, and export settings for the selected platform.
          </div>
        </div>
        <div className="panel-body">
          <label className="field">
            <span className="field-label">Journey name</span>
            <input className="field-input" value={form.name} onChange={(event) => onFormChange("name", event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Objective</span>
            <textarea
              className="field-input multiline short"
              value={form.objective}
              onChange={(event) => onFormChange("objective", event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Entry trigger</span>
            <select className="field-input" value={form.entryTrigger} onChange={(event) => onFormChange("entryTrigger", event.target.value)}>
              <option value="audienceQualified">audienceQualified</option>
              <option value="ticketPurchase">ticketPurchase</option>
              <option value="appSessionStart">appSessionStart</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Audience</span>
            <select className="field-input" value={form.audience} onChange={(event) => onFormChange("audience", event.target.value)}>
              <option value="Recent_Attendees_No_App_30d">Recent_Attendees_No_App_30d</option>
              <option value="Recent_Event_Attendees_No_Purchase">Recent_Event_Attendees_No_Purchase</option>
              <option value="Lapsed_Customers_45d">Lapsed_Customers_45d</option>
              <option value="Subscription_Renewal_Window_10d">Subscription_Renewal_Window_10d</option>
            </select>
          </label>

          <div className="field">
            <span className="field-label">Channels</span>
            <div className="toggle-row">
              {[
                ["email", "Email"],
                ["push", "Push"],
                ["sms", "SMS"],
                ["inApp", "In-App"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`channel-chip ${form.channels[key] ? "on" : "off"}`}
                  onClick={() => onToggleChannel(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="two-col">
            <label className="field">
              <span className="field-label">Duration</span>
              <select className="field-input" value={form.duration} onChange={(event) => onFormChange("duration", event.target.value)}>
                {durationOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Frequency cap</span>
              <select className="field-input" value={form.frequencyCap} onChange={(event) => onFormChange("frequencyCap", event.target.value)}>
                {frequencyOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="group-box purple">
            <div className="field-label purple-text">A/B experiment</div>
            <label className="field compact">
              <span className="field-label small">Variant A</span>
              <input className="field-input" value={form.variantA} onChange={(event) => onFormChange("variantA", event.target.value)} />
            </label>
            <label className="field compact">
              <span className="field-label small">Variant B</span>
              <input className="field-input" value={form.variantB} onChange={(event) => onFormChange("variantB", event.target.value)} />
            </label>
            <div className="slider-row">
              <input type="range" min="10" max="90" value={form.split} onChange={(event) => onFormChange("split", Number(event.target.value))} />
              <span className="slider-value">
                {form.split}% / {100 - form.split}%
              </span>
            </div>
          </div>

          <div className="group-box teal">
            <div className="field-label teal-text">Holdout</div>
            <div className="slider-row">
              <input type="range" min="5" max="30" value={form.holdout} onChange={(event) => onFormChange("holdout", Number(event.target.value))} />
              <span className="slider-value">{form.holdout}%</span>
            </div>
            <div className="helper-text">Excluded from outbound messages and reserved for incrementality tracking.</div>
          </div>

          <label className="field">
            <span className="field-label">Attribution</span>
            <select className="field-input" value={form.attribution} onChange={(event) => onFormChange("attribution", event.target.value)}>
              <option>Last-touch (21-day)</option>
              <option>First-touch</option>
              <option>Linear</option>
            </select>
          </label>

          <button type="button" className="button primary full" onClick={onGenerate} disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            {busy ? "Generating..." : "Generate Journey Config & QA"}
          </button>

          {busy ? (
            <div className="progress-stack">
              <div className="progress-track">
                <span className="progress-fill" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="progress-label">{progress.message}</div>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="panel content-panel">
        <div className="content-tabs">
          <div className="tab-strip">
            {TAB_IDS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`tab-button ${tab === entry.id ? "on" : ""}`}
                onClick={() => onTabChange(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {data.generated ? (
            <div className="tab-actions">
              <button type="button" className="button secondary small" onClick={handleCopy}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className={`button primary small ${sendState === "sent" ? "success" : ""}`}
                onClick={() => onSend()}
                disabled={sendState !== "idle"}
              >
                {sendState === "sending" ? <span className="spinner" /> : null}
                {sendState === "sending" ? "Preparing..." : sendState === "sent" ? platformSentLabel(platform) : platformSendLabel(platform)}
              </button>
              {showActivationCard && ["ready", "activating", "sent"].includes(sendState) ? (
                <div className={`ajo-activation-card ${sendState === "sent" ? "done" : ""}`}>
                  <div>
                    <strong>{sendState === "sent" ? platformSentLabel(platform) : "Activate Journey"}</strong>
                    <span>{sendState === "sent" ? "Journey has been activated in AJO." : "Review complete. Activate the journey when ready."}</span>
                  </div>
                  {sendState !== "sent" ? (
                    <button type="button" className="button primary small" onClick={() => onActivate?.()} disabled={sendState === "activating"}>
                      {sendState === "activating" ? <span className="spinner" /> : null}
                      {sendState === "activating" ? "Activating..." : "Activate Journey"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={`content-body${tab === "qa" ? " content-body--qa" : ""}`}>
          {!data.generated ? (
            <div className="empty-state">
              <div className="empty-state-mark">CFG</div>
              <p>Generate the journey config to populate the audience, canvas, measurement, and API export tabs.</p>
            </div>
          ) : (
            <>
              <StatusChips />

              {tab === "audience" ? (
                <>
                  <ConfigCard accent="#2680EB" title="Primary Audience Segment" badge="Audience">
                    <div className="detail-grid">
                      <div className="detail-row">
                        <span className="detail-key">segment.name</span>
                        <span className="detail-value">{form.audience}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">entry.trigger</span>
                        <span className="detail-value">{form.entryTrigger}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">channels</span>
                        <span className="detail-value">{activeChannels}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">est.audience</span>
                        <span className="detail-value">
                          {singleUseHoldout
                            ? `14,200 total / ${holdoutCount.toLocaleString()} holdout excluded`
                            : "14,200 total / holdout disabled"}
                        </span>
                      </div>
                    </div>
                  </ConfigCard>

                  <ConfigCard accent="#0FB8B8" title="Holdout Segment" badge="Incrementality">
                    <div className="detail-grid">
                      {singleUseHoldout ? (
                        <>
                          <div className="detail-row">
                            <span className="detail-key">segment.name</span>
                            <span className="detail-value">{`Holdout_${form.holdout}pct`}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-key">sampling</span>
                            <span className="detail-value">{form.holdout}% deterministic sample on profile id</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-key">tracking</span>
                            <span className="detail-value">liftBaselineTracked</span>
                          </div>
                        </>
                      ) : (
                        <div className="detail-row">
                          <span className="detail-key">status</span>
                          <span className="detail-value">Holdout disabled for this campaign</span>
                        </div>
                      )}
                    </div>
                  </ConfigCard>

                  <ConfigCard accent="#8B5CF6" title="Experiment Segments" badge="A/B Test">
                    <div className="detail-grid">
                      {singleUseAB ? (
                        <>
                          <div className="detail-row">
                            <span className="detail-key">variant.A</span>
                            <span className="detail-value">{form.split}% / {form.variantA}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-key">variant.B</span>
                            <span className="detail-value">{100 - form.split}% / {form.variantB}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-key">success.metric</span>
                            <span className="detail-value">purchase or primary conversion event at 21d</span>
                          </div>
                        </>
                      ) : (
                        <div className="detail-row">
                          <span className="detail-key">status</span>
                          <span className="detail-value">Single-arm campaign (A/B disabled)</span>
                        </div>
                      )}
                    </div>
                  </ConfigCard>
                </>
              ) : null}

              {tab === "canvas" ? (
                <>
                  <ConfigCard accent="#2680EB" title="Journey Canvas Preview" badge="Canvas">
                    <CanvasPreview
                      orchestrationType={orchestrationType}
                      singleChannel={singleChannel}
                      singleUseHoldout={singleUseHoldout}
                      singleUseAB={singleUseAB}
                    />
                    <div className="info-box info-blue">The generated canvas mirrors the blueprint path and the current control values.</div>
                  </ConfigCard>

                  <ConfigCard accent="#2680EB" title="Journey Config" badge="Settings">
                    <div className="detail-grid">
                      <div className="detail-row">
                        <span className="detail-key">platform</span>
                        <span className="detail-value">{platform}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">journey.name</span>
                        <span className="detail-value">{journeyName}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">orchestration</span>
                        <span className="detail-value">
                          {isSingleTouchpoint
                            ? `single touchpoint / ${singleChannelLabel}`
                            : "multi-touch journey"}
                        </span>
                      </div>
                      {isSingleTouchpoint ? (
                        <div className="detail-row">
                          <span className="detail-key">timing.window</span>
                          <span className="detail-value">
                            send +{sendOffsetHours}h / outcome {outcomeWindowHours}h
                          </span>
                        </div>
                      ) : null}
                      <div className="detail-row">
                        <span className="detail-key">duration</span>
                        <span className="detail-value">{form.duration}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">frequency.cap</span>
                        <span className="detail-value">{form.frequencyCap}</span>
                      </div>
                    </div>
                  </ConfigCard>
                </>
              ) : null}

              {tab === "measurement" ? (
                <>
                  <ConfigCard accent="#C89B3C" title="Measurement Workspace" badge="Reporting">
                    <div className="detail-grid">
                      <div className="detail-row">
                        <span className="detail-key">workspace.name</span>
                        <span className="detail-value">{`${journeyName}_Measurement`}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">primary.metric</span>
                        <span className="detail-value">primary conversion rate</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">attribution</span>
                        <span className="detail-value">{form.attribution}</span>
                      </div>
                    </div>
                  </ConfigCard>

                  <ConfigCard accent="#0FB8B8" title="Incrementality" badge="Holdout">
                    <div className="detail-grid">
                      <div className="detail-row">
                        <span className="detail-key">holdout.segment</span>
                        <span className="detail-value">{`Holdout_${form.holdout}pct`}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">lift.metric</span>
                        <span className="detail-value">journey conversion minus holdout conversion</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">incremental.value</span>
                        <span className="detail-value">lift % x reachable audience x average order value</span>
                      </div>
                    </div>
                  </ConfigCard>
                </>
              ) : null}

              {tab === "qa" ? (
                <EmbeddedQAApp initialJourneyId={journeyId} autoSynth />
              ) : null}

              {tab === "json" ? (
                <ConfigCard accent="#2680EB" title="Journey API Payload" badge="JSON">
                  <pre className="json-block">{JSON.stringify(payload, null, 2)}</pre>
                </ConfigCard>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import type { TestEvent } from "@/lib/types";

interface Props {
  defaultPayload: unknown;
  disabled: boolean;
  onTrigger: (event: TestEvent) => void;
}

export default function EventComposer({ defaultPayload, disabled, onTrigger }: Props) {
  const [eventType, setEventType] = useState("cart_abandoned");
  const [identityNamespace, setIdentityNamespace] = useState("Email");
  const [identifier, setIdentifier] = useState("lina.brandt@northwind.io");
  const [waitOverride, setWaitOverride] = useState(10);
  const [payload, setPayload] = useState(JSON.stringify(defaultPayload, null, 2));

  function trigger() {
    let parsed: unknown = payload;
    try {
      parsed = JSON.parse(payload);
    } catch {
      // Send the raw string if the user typed invalid JSON.
    }
    onTrigger({
      eventType,
      identityNamespace,
      identifier,
      waitOverrideSeconds: waitOverride,
      payload: parsed,
    });
  }

  return (
    <div className="jo-event">
      <div className="jo-event__form">
        <h5>Event configuration</h5>
        <div className="jo-field">
          <label>Event</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="cart_abandoned">cart_abandoned</option>
            <option value="segment_qualified">segment_qualified</option>
            <option value="purchase_completed">purchase_completed</option>
            <option value="consent_revoked">consent_revoked</option>
          </select>
        </div>
        <div className="jo-field">
          <label>Identity namespace</label>
          <select value={identityNamespace} onChange={(e) => setIdentityNamespace(e.target.value)}>
            <option>Email</option>
            <option>Phone</option>
            <option>ECID</option>
            <option>CRMID</option>
            <option>AAID</option>
          </select>
        </div>
        <div className="jo-field">
          <label>Profile identifier</label>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div className="jo-field">
          <label>Wait override (s)</label>
          <input
            type="number"
            min={1}
            max={600}
            value={waitOverride}
            onChange={(e) => setWaitOverride(Number(e.target.value) || 10)}
          />
        </div>
        <div className="jo-field">
          <label>&nbsp;</label>
          <div className="jo-row" style={{ gap: 8 }}>
            <button type="button" className="jo-btn jo-btn--primary" onClick={trigger} disabled={disabled}>
              {disabled ? "Running…" : "Trigger event"}
            </button>
            <button type="button" className="jo-btn jo-btn--ghost">Save profile</button>
          </div>
        </div>
        <div className="jo-gen__hint" style={{ marginTop: 6 }}>
          Test mode bypasses Segment Qualification by injecting the event directly for this single profile.
          Channel actions are simulated; waits use the override above.
        </div>
      </div>
      <div className="jo-event__payload">
        <h5>
          Payload <span className="jo-pill" style={{ marginLeft: 6 }}>JSON</span>
        </h5>
        <textarea
          className="jo-codeview"
          spellCheck={false}
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
        />
      </div>
    </div>
  );
}

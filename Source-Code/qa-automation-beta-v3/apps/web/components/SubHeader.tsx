"use client";

import { useEffect, useState } from "react";
import type { Journey, JourneySummary, Segment } from "@/lib/types";

interface Props {
  journey: Journey;
  journeys: JourneySummary[];
  onSelectJourney: (id: string) => void;
  segments: Segment[];
  selectedSegmentId: string | null;
  onSegmentChange: (id: string) => void;
  qaRunning: boolean;
  synthRunning: boolean;
  onGenerateAndRun: () => void;
  canSynth: boolean;
  hasSuites: boolean;
}

// Sub-header — the global top bar has been removed. This houses the journey
// dropdown (replaces the static title) plus the Save draft action. The mode
// switcher, Validate, and Publish controls were also removed per spec.
export default function SubHeader({
  journey,
  journeys,
  onSelectJourney,
  segments,
  selectedSegmentId,
  onSegmentChange,
  qaRunning,
  synthRunning,
  onGenerateAndRun,
  canSynth,
  hasSuites,
}: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".jo-jpicker")) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? journeys.filter((j) => j.name.toLowerCase().includes(q) || j.owner.toLowerCase().includes(q))
    : journeys;

  function statusClass(status: string): string {
    return `jo-badge jo-badge--${status.toLowerCase()}`;
  }

  return (
    <div className="jo-subhead">
      <div className="jo-subhead__title">
        <div className="jo-jpicker">
          <button
            type="button"
            className={"jo-jpicker__btn" + (open ? " is-open" : "")}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="jo-jpicker__col">
              <span className="jo-eyebrow">Journey</span>
              <span className="jo-jpicker__name">{journey.name}</span>
            </span>
            <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" className="jo-jpicker__chev">
              <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth={1.5} />
            </svg>
          </button>

          {open && (
            <div className="jo-jpicker__menu" role="listbox">
              <div className="jo-jpicker__search">
                <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden="true">
                  <circle cx={7} cy={7} r={5} fill="none" stroke="currentColor" strokeWidth={1.5} />
                  <path d="M11 11 L15 15" stroke="currentColor" strokeWidth={1.5} />
                </svg>
                <input
                  placeholder="Filter journeys…"
                  autoFocus
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <ul>
                {filtered.map((j) => {
                  const isActive = j.id === journey.id;
                  return (
                    <li
                      key={j.id}
                      role="option"
                      aria-selected={isActive}
                      className={"jo-jpicker__item" + (isActive ? " is-active" : "")}
                      onClick={() => {
                        onSelectJourney(j.id);
                        setOpen(false);
                      }}
                    >
                      <div className="jo-jpicker__item-main">
                        <div className="jo-jpicker__item-name">{j.name}</div>
                        <div className="jo-jpicker__item-meta">
                          <span>v{j.version}</span>
                          <span>·</span>
                          <span>{j.updated}</span>
                          <span>·</span>
                          <span>{j.owner}</span>
                        </div>
                      </div>
                      <span className={statusClass(j.status)}>{j.status}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className={`jo-spicker${selectedSegmentId ? "" : " is-empty"}`}>
          <span className="jo-eyebrow">Segment</span>
          <span className="jo-spicker__name">
            {selectedSegmentId
              ? (() => {
                  const s = segments.find((x) => x.id === selectedSegmentId);
                  return s ? `${s.name} · ${s.size}` : "Select segment…";
                })()
              : "Select segment…"}
          </span>
          <svg className="jo-spicker__chev" viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
            <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth={1.5} />
          </svg>
          <select
            className="jo-spicker__select"
            value={selectedSegmentId ?? ""}
            onChange={(e) => onSegmentChange(e.target.value)}
            aria-label="Segment"
          >
            <option value="" disabled>Select segment…</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.size}
              </option>
            ))}
          </select>
        </div>

        <div className="jo-subhead__meta">
          <span className={statusClass(journey.status)}>{journey.status}</span>
          <span>v{journey.version}</span>
          <span>·</span>
          <span>Updated {journey.updated}</span>
          <span>·</span>
          <span>{journey.owner}</span>
        </div>
      </div>

      <div className="jo-subhead__right">
        <div className="jo-subhead__actions">
          <button type="button" className="jo-btn jo-btn--ghost">
            Save draft
          </button>
          <button
            type="button"
            className="jo-btn jo-btn--primary"
            disabled={!canSynth || qaRunning || synthRunning}
            onClick={onGenerateAndRun}
            title={hasSuites ? "Regenerate profiles & QA suites" : "Generate profiles & QA suites for this journey + segment"}
          >
            {synthRunning ? "Generating…" : hasSuites ? "Regenerate" : "Generate Profiles & Suites"}
          </button>
        </div>
      </div>
    </div>
  );
}

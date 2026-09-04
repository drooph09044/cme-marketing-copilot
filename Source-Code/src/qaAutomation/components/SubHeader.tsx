"use client";

import { useEffect, useRef, useState } from "react";
import type { Journey, JourneySummary, Segment } from "../lib/types";

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
  /** When true, both the journey and segment pickers are locked (pre-selected context). */
  disableSelectors?: boolean;
}

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
  disableSelectors = false,
}: Props) {
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const journeyRef = useRef<HTMLDivElement>(null);
  const segmentRef = useRef<HTMLDivElement>(null);

  // Click-outside handler for both dropdowns
  useEffect(() => {
    if (!journeyOpen && !segmentOpen) return;
    function onDoc(e: MouseEvent) {
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      const inJourney = path.some((el) => el === journeyRef.current);
      const inSegment = path.some((el) => el === segmentRef.current);
      if (!inJourney) setJourneyOpen(false);
      if (!inSegment) setSegmentOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [journeyOpen, segmentOpen]);

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? journeys.filter((j) => j.name.toLowerCase().includes(q) || (j.owner || "").toLowerCase().includes(q))
    : journeys;

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) ?? null;

  function statusClass(status: string): string {
    return `jo-badge jo-badge--${status.toLowerCase()}`;
  }

  const ChevronIcon = () => (
    <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" style={{ fill: "none", flexShrink: 0, transition: "transform 120ms ease", color: "var(--ink-3)" }}>
      <path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );

  return (
    <div className="jo-subhead">
      <div className="jo-subhead__title">

        {/* ── Journey picker ─────────────────────────────── */}
        <div className="jo-jpicker" ref={journeyRef}>
          <button
            type="button"
            className={"jo-jpicker__btn" + (journeyOpen ? " is-open" : "") + (disableSelectors ? " is-locked" : "")}
            onClick={() => { if (disableSelectors) return; setJourneyOpen((v) => !v); setSegmentOpen(false); }}
            aria-haspopup="listbox"
            aria-expanded={journeyOpen}
            disabled={disableSelectors}
          >
            <span className="jo-jpicker__col">
              <span className="jo-eyebrow">Journey</span>
              <span className="jo-jpicker__name">{journey.name}</span>
            </span>
            <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true" className="jo-jpicker__chev">
              <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth={1.5} />
            </svg>
          </button>

          {journeyOpen && (
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
                      onClick={() => { onSelectJourney(j.id); setJourneyOpen(false); setFilter(""); }}
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

        {/* ── Segment picker (custom — no native select) ─── */}
        <div
          ref={segmentRef}
          className={"jo-spicker" + (selectedSegmentId ? "" : " is-empty") + (segmentOpen ? " is-open" : "")}
          style={{ position: "relative" }}
        >
          <button
            type="button"
            className={"jo-spicker__btn" + (disableSelectors ? " is-locked" : "")}
            onClick={() => { if (disableSelectors) return; setSegmentOpen((v) => !v); setJourneyOpen(false); }}
            aria-haspopup="listbox"
            aria-expanded={segmentOpen}
            disabled={disableSelectors}
          >
            <span className="jo-eyebrow">Segment</span>
            <span className="jo-spicker__name">
              {selectedSegment ? `${selectedSegment.name} · ${selectedSegment.size}` : "Select segment…"}
            </span>
            <ChevronIcon />
          </button>

          {segmentOpen && segments.length > 0 && (
            <div className="jo-spicker__menu" role="listbox">
              <ul>
                {segments.map((s) => {
                  const isActive = s.id === selectedSegmentId;
                  return (
                    <li
                      key={s.id}
                      role="option"
                      aria-selected={isActive}
                      className={"jo-spicker__item" + (isActive ? " is-active" : "")}
                      onClick={() => { onSegmentChange(s.id); setSegmentOpen(false); }}
                    >
                      <span className="jo-spicker__item-name">{s.name}</span>
                      <span className="jo-spicker__item-size">{s.size}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
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

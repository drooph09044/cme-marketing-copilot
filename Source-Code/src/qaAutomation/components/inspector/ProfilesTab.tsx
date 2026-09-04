"use client";

import React, { useMemo, useState } from "react";
import type { Profile, ProfileTag, TestSuite } from "../../lib/types";

const FIRST = ["Lina", "Marc", "Sofia", "Jens", "Paula", "Tomáš", "Anouk", "Pierre", "Greta", "Henrik", "Mira", "Bence", "Aiko", "Noor", "Elif", "Kai"];
const LAST = ["Brandt", "Dupont", "Romano", "Vermeer", "Iglesias", "Novák", "De Vries", "Müller", "Costa", "Lindgren", "Petrova", "Bauer"];
const REGIONS = ["DE", "FR", "NL", "ES", "IT"];

function makeProfile(i: number): Profile {
  const name = `${FIRST[(Math.random() * FIRST.length) | 0]} ${LAST[(Math.random() * LAST.length) | 0]}`;
  const region = REGIONS[(Math.random() * REGIONS.length) | 0];
  const id = "p_" + String(50000 + i + ((Math.random() * 9000) | 0)).slice(0, 5);
  const fcap = (Math.random() * 4) | 0;
  const consent = Math.random() > 0.12;
  const tag: ProfileTag = !consent
    ? "suppressed"
    : fcap >= 3
      ? "fcap-risk"
      : Math.random() < 0.1
        ? "control"
        : "test";
  return { id, name, region, age: 18 + ((Math.random() * 48) | 0), consent, fcap, lastSend: `${(Math.random() * 40) | 0}d`, segment: "dormant_30d", tag };
}

type Filter = "all" | ProfileTag;

interface Props {
  profiles: Profile[];
  setProfiles: (p: Profile[]) => void;
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  testSuites: TestSuite[];
  onExtendSuites: (instruction: string, count: number) => void;
  extendError: string | null;
  clearExtendError: () => void;
  synthRunning: boolean;
  canSynth: boolean;
}

const EXAMPLE_PROMPTS = [
  "Add 3 profiles with email opted-out but SMS+push enabled",
  "More high-fcap profiles for the Frequency Cap suite",
  "Add 2 ineligible profiles in DE region",
  "Generate 4 Happy Path variations with Medium engagement",
];

export default function ProfilesTab({
  profiles, setProfiles, selectedIds, setSelectedIds,
  testSuites, onExtendSuites, extendError, clearExtendError, synthRunning, canSynth,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  // Free-form instruction the user types to describe more profiles to add.
  const [instruction, setInstruction] = useState("");
  const [extendCount, setExtendCount] = useState(3);

  const disabledReason =
    !canSynth ? "Select a journey + segment in the header first." :
    testSuites.length === 0 ? "Generate test suites in the QA Runs tab first." :
    !instruction.trim() ? "Describe what kind of profile to add." :
    synthRunning ? "A synth job is already running." :
    null;

  const handleExtend = () => {
    if (disabledReason) return;
    clearExtendError();
    onExtendSuites(instruction.trim(), extendCount);
    setInstruction("");
  };

  function addManual() {
    const p = makeProfile(profiles.length);
    setProfiles([...profiles, p]);
    setEditingId(p.id);
    setDraft({ ...p });
  }

  function startEdit(p: Profile) {
    setEditingId(p.id);
    setDraft({ ...p });
  }

  function saveDraft() {
    if (!draft) return;
    setProfiles(profiles.map((p) => (p.id === draft.id ? draft : p)));
    setEditingId(null);
    setDraft(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function deleteProfile(id: string) {
    setProfiles(profiles.filter((p) => p.id !== id));
    if (editingId === id) { setEditingId(null); setDraft(null); }
    const s = new Set(selectedIds);
    s.delete(id);
    setSelectedIds(s);
  }

  function patchDraft<K extends keyof Profile>(key: K, value: Profile[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
  }

  function toggleSel(id: string) {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  }
  function toggleAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p) => p.id)));
  }

  const filtered = useMemo<Profile[]>(() => {
    if (filter === "all") return profiles;
    return profiles.filter((p) => p.tag === filter);
  }, [profiles, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: profiles.length, test: 0, control: 0, suppressed: 0, "fcap-risk": 0, holdout: 0 };
    for (const p of profiles) c[p.tag] = (c[p.tag] ?? 0) + 1;
    return c;
  }, [profiles]);

  const chipDefs: Array<[Filter, string]> = [
    ["all", "All"], ["test", "Test"], ["control", "Control"],
    ["holdout", "Holdout"], ["fcap-risk", "Cap risk"], ["suppressed", "Suppressed"],
  ];

  const TAGS: ProfileTag[] = ["test", "control", "suppressed", "fcap-risk", "holdout"];

  return (
    <div className="jo-pane">
      <div className="jo-pane__head">
        <div>
          <h3>Test profiles</h3>
          <p>Manual profile management. Auto-generated test suites live in the QA Runs tab.</p>
        </div>
        <div className="jo-row">
          <button className="jo-btn jo-btn--ghost" type="button" onClick={addManual}>Add</button>
        </div>
      </div>

      {/* Describe-what-to-add panel */}
      <div className="jo-extend">
        <div className="jo-extend__head">
          <h4>Add more profiles</h4>
          <span>
            {testSuites.length === 0
              ? "Generate test suites in the QA Runs tab first."
              : "Describe what kind of profile to add — it'll join the right suite."}
          </span>
        </div>
        <textarea
          className="jo-extend__input"
          rows={2}
          value={instruction}
          placeholder={
            testSuites.length === 0
              ? "Disabled — generate test suites first."
              : "e.g. Add 3 high-fcap profiles for the Frequency Cap suite"
          }
          disabled={testSuites.length === 0 || synthRunning}
          onChange={(e) => {
            setInstruction(e.target.value);
            if (extendError) clearExtendError();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleExtend();
          }}
        />
        <div className="jo-extend__row">
          <label>
            Count
            <input
              type="number"
              min={1}
              max={20}
              value={extendCount}
              onChange={(e) => setExtendCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              disabled={testSuites.length === 0 || synthRunning}
            />
          </label>
          <button
            className="jo-btn jo-btn--primary"
            type="button"
            onClick={handleExtend}
            disabled={!!disabledReason}
            title={disabledReason ?? "Generate additional profiles based on your description"}
          >
            {synthRunning ? "Adding…" : "Add profiles"}
          </button>
        </div>
        {extendError && (
          <div className="jo-extend__error" role="alert">
            <strong>Couldn&apos;t add profiles:</strong> {extendError}
            <button type="button" onClick={clearExtendError} className="jo-extend__error-close">×</button>
          </div>
        )}
        {disabledReason && !instruction && !extendError && (
          <div className="jo-extend__hint">{disabledReason}</div>
        )}
        {testSuites.length > 0 && !instruction && !extendError && (
          <div className="jo-extend__examples">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                type="button"
                className="jo-extend__example"
                onClick={() => setInstruction(ex)}
                disabled={synthRunning}
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="jo-chips">
        {chipDefs.map(([k, label]) => (
          <button key={k} type="button" className={"jo-chip" + (filter === k ? " is-on" : "")} onClick={() => setFilter(k)}>
            {label} <i>{counts[k] ?? 0}</i>
          </button>
        ))}
      </div>

      <div className="jo-table-wrap jo-table-wrap--scroll">
        <table className="jo-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={toggleAll} />
              </th>
              <th>Profile</th>
              <th>Region</th>
              <th>Age</th>
              <th>Consent</th>
              <th>F-cap</th>
              <th>Last send</th>
              <th>Tag</th>
              <th style={{ width: 24 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <React.Fragment key={p.id}>
                <tr
                  className={(selectedIds.has(p.id) ? "is-sel" : "") + (editingId === p.id ? " is-editing" : "")}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).tagName === "INPUT") return;
                    editingId === p.id ? cancelEdit() : startEdit(p);
                  }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSel(p.id)} />
                  </td>
                  <td>
                    <div className="jo-prof">
                      <div className="jo-prof__avatar">{p.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</div>
                      <div>
                        <div className="jo-prof__name">{p.name}</div>
                        <div className="jo-prof__id">{p.id}</div>
                        {p.scenario && <div className="jo-prof__scenario">{p.scenario}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{p.region}</td>
                  <td>{p.age}</td>
                  <td>{p.consent ? <span className="jo-dot jo-dot--ok" /> : <span className="jo-dot jo-dot--bad" />}</td>
                  <td>{p.fcap}</td>
                  <td className="num">{p.lastSend}</td>
                  <td><span className={`jo-tag jo-tag--${p.tag}`}>{p.tag}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="jo-btn-icon"
                      type="button"
                      title="Delete"
                      onClick={() => deleteProfile(p.id)}
                    >×</button>
                  </td>
                </tr>
                {editingId === p.id && draft && (
                  <tr className="jo-prof-edit-row">
                    <td colSpan={9}>
                      <div className="jo-prof-edit">
                        <div className="jo-prof-edit__grid">
                          <label>
                            Name
                            <input
                              type="text"
                              value={draft.name}
                              onChange={(e) => patchDraft("name", e.target.value)}
                            />
                          </label>
                          <label>
                            Region
                            <select value={draft.region} onChange={(e) => patchDraft("region", e.target.value)}>
                              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </label>
                          <label>
                            Age
                            <input
                              type="number" min={18} max={99}
                              value={draft.age}
                              onChange={(e) => patchDraft("age", Number(e.target.value))}
                            />
                          </label>
                          <label>
                            F-cap
                            <input
                              type="number" min={0} max={10}
                              value={draft.fcap}
                              onChange={(e) => patchDraft("fcap", Number(e.target.value))}
                            />
                          </label>
                          <label>
                            Last send
                            <input
                              type="text"
                              value={draft.lastSend}
                              onChange={(e) => patchDraft("lastSend", e.target.value)}
                            />
                          </label>
                          <label>
                            Segment
                            <input
                              type="text"
                              value={draft.segment}
                              onChange={(e) => patchDraft("segment", e.target.value)}
                            />
                          </label>
                          <label>
                            Tag
                            <select value={draft.tag} onChange={(e) => patchDraft("tag", e.target.value as ProfileTag)}>
                              {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </label>
                          <label className="jo-prof-edit__consent">
                            <input
                              type="checkbox"
                              checked={draft.consent}
                              onChange={(e) => patchDraft("consent", e.target.checked)}
                            />
                            Consent
                          </label>
                        </div>
                        <div className="jo-prof-edit__actions">
                          <button className="jo-btn jo-btn--primary" type="button" onClick={saveDraft}>Save</button>
                          <button className="jo-btn jo-btn--ghost" type="button" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toneClass(tone) {
  if (tone === "teal" || tone === "blocked") {
    return "teal";
  }
  if (tone === "amber" || tone === "warning") {
    return "amber";
  }
  return "green";
}

function statusGlyph(status) {
  switch (status) {
    case "pass":
      return "OK";
    case "fail":
      return "NO";
    case "running":
      return "...";
    case "blocked":
      return "BL";
    case "warn":
      return "WR";
    case "skip":
      return "SK";
    default:
      return "--";
  }
}

function fallbackProfileAttributes(profile) {
  const values = [
    ["Segment", profile.segment],
    ["Games", profile.games],
    ["Last game", profile.lastGame],
    ["App active", typeof profile.appActive === "boolean" ? (profile.appActive ? "Yes" : "No") : undefined],
    ["Loyalty pts", Number.isFinite(profile.loyaltyPoints) ? profile.loyaltyPoints.toLocaleString() : undefined],
    ["Fan ID", profile.fanId],
  ];

  return values
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => ({ label, value }));
}

export function QaModule({
  profiles,
  suites,
  suiteScore,
  runAllBusy,
  selectedProfileId,
  profileRun,
  automationPlaybook,
  sourceLabel,
  onRunAll,
  onSelectProfile,
}) {
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const selectedProfileAttributes =
    Array.isArray(selectedProfile?.attributes) && selectedProfile.attributes.length
      ? selectedProfile.attributes
      : selectedProfile
        ? fallbackProfileAttributes(selectedProfile)
        : [];

  return (
    <div className="qa-grid">
      <div className="content-card qa-column">
        <div className="content-card-accent" style={{ background: "#0FB8B8" }} />
        <div className="content-card-head">
          <div className="content-card-title">Profiles</div>
          {/* <span className="badge teal">{sourceLabel ? `${sourceLabel} Synthetic` : "Synthetic"}</span> */}
        </div>
        <div className="list-body">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={`list-card ${selectedProfileId === profile.id ? "on" : ""}`}
              onClick={() => onSelectProfile(profile.id)}
            >
              <div className="list-card-top">
                <div className="profile-avatar">{profile.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="list-card-title">{profile.name}</div>
                  <div className="list-card-meta">
                    {profile.type} / {profile.id}
                  </div>
                </div>
              </div>
              <div className={`outcome-chip ${profile.expectedTone}`}>{profile.expectedOutcome}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="content-card qa-column">
        <div className="content-card-accent" style={{ background: "#0FB8B8" }} />
        <div className="content-card-head">
          <div className="content-card-title">QA Suites</div>
          <button type="button" className="button teal small" onClick={onRunAll} disabled={runAllBusy}>
            {runAllBusy ? <span className="spinner" /> : null}
            {runAllBusy ? "Running..." : "Run All"}
          </button>
        </div>
        <div className="content-card-body">
          {suiteScore ? (
            <div className="suite-score-row">
              <span className="score-pill green">{suiteScore.passed} passed</span>
              <span className="score-pill red">{suiteScore.failed} failed</span>
            </div>
          ) : null}
          <div className="qa-suite-stack">
            {suites.map((suite) => (
              <div className="suite-card qa-suite-card" key={suite.id}>
                <div className="suite-card-top">
                  <div className={`suite-status ${suite.status}`}>{statusGlyph(suite.status)}</div>
                  <div>
                    <div className="list-card-title">{suite.name}</div>
                    <div className="list-card-meta">
                      {suite.description} / {suite.testCount} tests
                    </div>
                  </div>
                </div>
                {suite.status === "running" ? (
                  <div className="progress-track">
                    <span className="progress-fill teal looping" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="section-label" style={{ marginTop: 16 }}>
            Automation Playbook
          </div>
          <div className="qa-playbook-stack">
            {automationPlaybook.map((item) => (
              <div className="group-box" key={item.title}>
                <div className="content-card-title" style={{ color: item.accent }}>
                  {item.title}
                </div>
                <div className="helper-text">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="content-card qa-column qa-results">
        <div className="content-card-accent" style={{ background: "#0FB8B8" }} />
        <div className="content-card-head">
          <div className="content-card-title">Simulation Results</div>
          <span className="badge subtle">
            {selectedProfile ? `${selectedProfile.name} / ${selectedProfile.id}` : "Select a profile"}
          </span>
        </div>
        <div className="content-card-body">
          {!selectedProfile || !profileRun ? (
            <div className="empty-state">
              <div className="empty-state-mark">QA</div>
              <p>Select a synthetic {sourceLabel ? `${sourceLabel.toLowerCase()} ` : ""}profile to animate the journey simulation.</p>
            </div>
          ) : (
            <>
              <div className="profile-stat-grid">
                {selectedProfileAttributes.map(({ label, value }) => (
                  <div className="profile-stat" key={label}>
                    <div className="detail-key">{label}</div>
                    <div className="profile-stat-value">{value}</div>
                  </div>
                ))}
              </div>
              <div className={`outcome-chip ${selectedProfile.expectedTone}`}>Expected: {selectedProfile.expectedOutcome}</div>

              <div className="section-label" style={{ marginTop: 18 }}>
                Journey Simulation
              </div>
              {profileRun.steps.map((step, index) => (
                <div className="simulation-step" key={`${step.label}-${index}`}>
                  <div className={`suite-status ${step.status}`}>{statusGlyph(step.status)}</div>
                  <div className="simulation-step-copy">
                    <div className="simulation-step-title">{step.label}</div>
                    <div className="simulation-step-text">{step.description}</div>
                  </div>
                  <div className={`simulation-step-state ${step.status}`}>{step.status.toUpperCase()}</div>
                </div>
              ))}
              {profileRun.running ? (
                <div className="simulation-running">
                  <span className="spinner" />
                  Running next check...
                </div>
              ) : null}
              {!profileRun.running ? (
                <div className={`summary-box ${toneClass(profileRun.summaryTone)}`}>{profileRun.summaryText}</div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

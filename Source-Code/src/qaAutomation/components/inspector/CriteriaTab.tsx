import type { Journey } from "../../lib/types";

interface Props {
  journey: Journey;
}

export default function CriteriaTab({ journey }: Props) {
  const suppressedTotal = journey.suppression.reduce((a, b) => a + b.count, 0);

  return (
    <div className="jo-pane">
      <div className="jo-pane__head">
        <div>
          <h3>Journey criteria</h3>
          <p>Entry conditions, holdouts and suppression sources configured on this journey.</p>
        </div>
      </div>

      <section className="jo-section">
        <header>
          <h4>Entry criteria</h4>
          <span>{journey.criteria.length} rule{journey.criteria.length !== 1 ? "s" : ""}</span>
        </header>
        {journey.criteria.length === 0 ? (
          <p className="jo-qa-ok">No entry criteria configured.</p>
        ) : (
          <ul className="jo-rules">
            {journey.criteria.map((c) => (
              <li key={c.id} className={`jo-rule jo-rule--${c.status}`}>
                <span className="jo-rule__mark" />
                <span className="jo-rule__label">{c.label}</span>
                {c.note ? <span className="jo-rule__note">{c.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="jo-section">
        <header>
          <h4>Holdouts</h4>
          <span>{journey.holdouts.length} active</span>
        </header>
        {journey.holdouts.length === 0 ? (
          <p className="jo-qa-ok">No holdouts configured on this journey.</p>
        ) : (
          journey.holdouts.map((h) => (
            <div key={h.id} className="jo-card">
              <div className="jo-card__top">
                <div className="jo-card__title">{h.name}</div>
                <div className="jo-card__pct">{h.pct}%</div>
              </div>
              <div className="jo-card__row"><span>Basis</span><b>{h.basis}</b></div>
              <div className="jo-card__row"><span>Scope</span><b>{h.scope}</b></div>
            </div>
          ))
        )}
      </section>

      <section className="jo-section">
        <header>
          <h4>Suppression sources</h4>
          <span>{suppressedTotal > 0 ? `${suppressedTotal.toLocaleString()} profiles` : "—"}</span>
        </header>
        {journey.suppression.length === 0 ? (
          <p className="jo-qa-ok">No suppression sources configured on this journey.</p>
        ) : (
          <ul className="jo-list">
            {journey.suppression.map((s) => (
              <li key={s.id}>
                <div>
                  <div className="jo-list__label">{s.label}</div>
                  <div className="jo-list__sub">{s.source}</div>
                </div>
                <div className="jo-list__num">{s.count.toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { FAMILIES, type Rect } from '../flow/families';
import { go } from '../lib/router';

export function Diagram({ rects, size = 40 }: { rects: Rect[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="diagram">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={1.6} className={r.accent ? 'accent' : ''} />
      ))}
    </svg>
  );
}

export function Steps({ step, total }: { step: number; total: number }) {
  return (
    <div className="steps" aria-label={`Step ${step} of ${total}`}>
      <span className="muted">Step {step} of {total}</span>
      <div className="step-bars">{Array.from({ length: total }, (_, i) => <span key={i} className={i < step ? 'on' : ''} />)}</div>
    </div>
  );
}

/** Step 1: what kind of card? */
export default function KindPicker() {
  return (
    <main className="page flow">
      <div className="flow-top">
        <button type="button" className="link" onClick={() => go('')}>Cancel</button>
        <Steps step={1} total={3} />
      </div>
      <h1>What kind of card?</h1>
      <p className="lead">Pick a style and the right frame is loaded for you.</p>
      <div className="kind-grid">
        {FAMILIES.map((f) => (
          <button
            key={f.id}
            type="button"
            className="kind-tile"
            disabled={!f.ready}
            onClick={() => go(`new/${f.id}`)}
          >
            <Diagram rects={f.diagram} />
            <span className="kind-text">
              <span className="kind-name">{f.name}</span>
              <span className="kind-meta">{f.ready ? f.meta : 'Coming soon'}</span>
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}

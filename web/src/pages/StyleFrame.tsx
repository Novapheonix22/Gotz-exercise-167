import type { Border, Card, CardSet, FrameColor, FrameToggles, Legendary } from '../model/card';
import type { Packs } from '../render/frameResolver';
import type { Store } from '../data/store';
import { familyById } from '../flow/families';
import { CardCanvas } from '../components/CardCanvas';
import SetPicker from '../components/SetPicker';
import { Diagram, Steps } from './KindPicker';

interface Props {
  card: Card;
  setCard: (c: Card) => void;
  packs: Packs;
  store: Store;
  sets: CardSet[];
  onSetsChanged: () => Promise<void>;
  onBack: () => void;
  onContinue: () => void;
  /** True when changing the style of an existing card. */
  editing?: boolean;
}

const TOGGLES: { key: keyof FrameToggles; label: string; hint: string }[] = [
  { key: 'nickname', label: 'Nickname', hint: 'Big nickname on top, true name underneath' },
  { key: 'snow', label: 'Snow', hint: 'Snowy frame texture' },
  { key: 'nyx', label: 'Enchantment (Nyx)', hint: 'Starry Nyx frame' },
  { key: 'devoid', label: 'Devoid', hint: 'Colorless, see-through frame' },
];

const COLORS: { id: FrameColor; label: string }[] = [
  { id: 'auto', label: 'Auto (from mana cost)' },
  { id: 'W', label: 'White' }, { id: 'U', label: 'Blue' }, { id: 'B', label: 'Black' },
  { id: 'R', label: 'Red' }, { id: 'G', label: 'Green' }, { id: 'M', label: 'Gold (multicolor)' },
  { id: 'A', label: 'Artifact' }, { id: 'L', label: 'Land' },
];

/** Step 2: style within the family plus every toggle that changes the frame. */
export default function StyleFrame({ card, setCard, packs, store, sets, onSetsChanged, onBack, onContinue, editing }: Props) {
  const family = familyById(card.family);
  if (!family) return null;
  const set = <K extends keyof Card>(k: K, v: Card[K]) => setCard({ ...card, [k]: v });
  const pickStyle = (id: string) => {
    const next = { ...card, style: id };
    if (id === 'land') { next.cardType = 'Land'; next.power = ''; next.toughness = ''; }
    if (id === 'vehicle') { next.cardType = 'Artifact'; next.subtype = next.subtype.includes('Vehicle') ? next.subtype : `Vehicle ${next.subtype}`.trim(); }
    if (id === 'regular' && (card.style === 'land' || card.style === 'vehicle')) {
      next.cardType = 'Creature';
      next.subtype = next.subtype.replace(/\bVehicle\b\s*/, '');
    }
    setCard(next);
  };
  const s = family.supports;
  const visibleToggles = TOGGLES.filter((t) => s[t.key]);
  const chooseSet = (st: CardSet | null) => setCard({ ...card, setId: st?.id ?? null, setCode: st?.code ?? card.setCode });
  const symbol = sets.find((x) => x.id === card.setId)?.symbol;

  return (
    <main className="page flow">
      <div className="flow-top">
        <button type="button" className="link" onClick={onBack}>Back</button>
        {editing ? <span className="muted">Change style and frame</span> : <Steps step={2} total={3} />}
      </div>
      <div className="style-head">
        <div>
          <span className="pill">{family.name}</span>
          <h1>Style and frame</h1>
          <p className="lead">Only options this style supports are shown.</p>
        </div>
        <CardCanvas card={card} packs={packs} scale={0.07} setSymbol={symbol} className="mini-card" aria-label="Preview" />
      </div>

      {family.styles.length > 1 && (
        <div className="style-grid">
          {family.styles.map((st) => (
            <button key={st.id} type="button" className={card.style === st.id ? 'style-tile on' : 'style-tile'} aria-pressed={card.style === st.id} disabled={!st.ready} onClick={() => pickStyle(st.id)}>
              <Diagram rects={st.diagram} size={34} />
              <span>{st.name}</span>
              {!st.ready && <small className="muted">Soon</small>}
            </button>
          ))}
        </div>
      )}

      {s.legendary && (
        <div className="group">
          <span className="field-label">Legendary</span>
          <div className="segmented two" role="radiogroup" aria-label="Legendary">
            {(['none', 'crown'] as Legendary[]).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={card.legendary === v} className={card.legendary === v ? 'on' : ''}
                onClick={() => setCard({
                  ...card, legendary: v,
                  supertype: v === 'crown'
                    ? (/\bLegendary\b/.test(card.supertype) ? card.supertype : `Legendary ${card.supertype}`.trim())
                    : card.supertype.replace(/\bLegendary\b\s*/, ''),
                })}>
                {v === 'none' ? 'Not legendary' : 'Legend crown'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="group">
        {visibleToggles.map((t) => (
          <label key={t.key} className="toggle">
            <span className="toggle-text"><span>{t.label}</span><small className="muted">{t.hint}</small></span>
            <input type="checkbox" role="switch" checked={card.toggles[t.key]}
              onChange={(e) => set('toggles', { ...card.toggles, [t.key]: e.target.checked })} />
          </label>
        ))}
        <label className="field">
          <span>Frame color</span>
          <select value={card.frameColor} onChange={(e) => set('frameColor', e.target.value as FrameColor)}>
            {COLORS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Border</span>
          <select value={card.border} onChange={(e) => set('border', e.target.value as Border)}>
            <option value="black">Black</option>
            <option value="white">White</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
        </label>
      </div>

      <div className="group">
        <span className="field-label">Set and symbol</span>
        <SetPicker store={store} sets={sets} value={card.setId} onChange={chooseSet} onSetsChanged={onSetsChanged} />
      </div>

      <div className="flow-bottom">
        <button type="button" className="primary wide" onClick={onContinue}>{editing ? 'Done' : 'Continue'}</button>
      </div>
    </main>
  );
}

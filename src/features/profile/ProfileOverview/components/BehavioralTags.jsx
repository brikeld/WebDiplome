import { PoFold } from './PoCard.jsx';
import PersonaPill from './PersonaPill.jsx';

function ChipBlock({ label, items, dominantPersona }) {
  if (!items?.length) return null;
  return (
    <div className="po-block">
      <span className="po-block-label">{label}</span>
      <div className="po-chip-row">
        {items.map((item) => (
          <PersonaPill key={item} dot personaKey={dominantPersona}>
            {item}
          </PersonaPill>
        ))}
      </div>
    </div>
  );
}

export default function BehavioralTags({ behavioral, lifestyle, dominantPersona = 'popularity', expanded = false }) {
  return (
    <>
      <p className="po-behavioral-type">{behavioral.profile_type}</p>
      <p className="po-summary-line">
        Inferred role: <strong>{behavioral.inferred_role}</strong>
      </p>

      <PoFold open={expanded}>
        <div className="po-block">
          <span className="po-block-label">Work context</span>
          <span className="po-kv-value">{behavioral.work_context}</span>
        </div>

        <ChipBlock label="Entertainment" items={lifestyle.entertainment_apps} dominantPersona={dominantPersona} />
        <ChipBlock label="Health tracking" items={lifestyle.health_tracking} dominantPersona={dominantPersona} />
        <ChipBlock label="Gaming" items={lifestyle.gaming} dominantPersona={dominantPersona} />

        {behavioral.badges?.length ? (
          <div className="po-block">
            <span className="po-block-label">Signals</span>
            <div className="po-chip-row">
              {behavioral.badges.map((badge) => (
                <PersonaPill key={badge}>{badge}</PersonaPill>
              ))}
            </div>
          </div>
        ) : null}
      </PoFold>
    </>
  );
}

import { PoFold } from './PoCard.jsx';
import PersonaPill from './PersonaPill.jsx';

export default function LocationInference({ identity, behavioral, dominantPersona = 'security', expanded = false }) {
  return (
    <>
      <div className="po-location-hero">
        <span className="po-location-pin" aria-hidden>
          📍
        </span>
        <div>
          <p className="po-location-place">{identity.location_inferred}</p>
          <p className="po-secondary">Inferred with high confidence</p>
        </div>
      </div>

      <PoFold open={expanded}>
        <div className="po-block">
          <span className="po-block-label">Institution</span>
          <span className="po-kv-value">{behavioral.school_detected}</span>
        </div>

        {identity.languages?.length ? (
          <div className="po-block">
            <span className="po-block-label">Languages</span>
            <div className="po-chip-row">
              {identity.languages.map((lang) => (
                <PersonaPill key={lang} dot personaKey={dominantPersona}>
                  {lang}
                </PersonaPill>
              ))}
            </div>
          </div>
        ) : null}

        <p className="po-secondary po-foot-note">
          Regular café and home network patterns detected.
        </p>
      </PoFold>
    </>
  );
}

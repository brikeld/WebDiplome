import PersonaPill from './PersonaPill.jsx';

export default function LocationInference({ location }) {
  const languages = location?.languages ?? [];

  return (
    <>
      {location?.place ? (
        <div className="po-location-hero">
          <span className="po-location-pin" aria-hidden>📍</span>
          <div>
            <p className="po-location-place">{location.place}</p>
            {location.source ? <p className="po-secondary">{location.source}</p> : null}
          </div>
        </div>
      ) : null}

      {languages.length > 0 ? (
        <div className="po-block">
          <span className="po-block-label">System languages</span>
          <div className="po-chip-row">
            {languages.map((lang) => (
              <PersonaPill key={lang} dot personaKey="security">
                {lang}
              </PersonaPill>
            ))}
          </div>
        </div>
      ) : null}

      {location?.locale ? (
        <p className="po-secondary po-foot-note">
          System locale <code className="po-code-tag">{location.locale}</code>
        </p>
      ) : null}
    </>
  );
}

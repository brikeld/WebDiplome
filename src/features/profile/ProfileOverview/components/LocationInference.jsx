export default function LocationInference({ identity, behavioral }) {
  return (
    <div className="po-card po-location">
      <p className="po-card-title">Location Inference</p>

      <div className="po-location-hero">
        <span className="po-location-pin">📍</span>
        <div>
          <p className="po-location-place">{identity.location_inferred}</p>
          <p className="po-secondary">Inferred with high confidence</p>
        </div>
      </div>

      <hr className="po-divider" />

      <div className="po-location-clue">
        <span className="po-secondary po-clue-label">Institution</span>
        <span className="po-location-value">{behavioral.school_detected}</span>
      </div>

      <div className="po-location-clue">
        <span className="po-secondary po-clue-label">Languages</span>
        <div className="po-badge-row" style={{ marginTop: 4 }}>
          {identity.languages.map(lang => (
            <span key={lang} className="po-pill">{lang}</span>
          ))}
        </div>
      </div>

      <div className="po-location-clue">
        <span className="po-secondary po-clue-label">Network patterns</span>
        <span className="po-secondary po-creepy-note" style={{ display: 'block', marginTop: 4 }}>
          Regular café and home network patterns detected
        </span>
      </div>
    </div>
  );
}

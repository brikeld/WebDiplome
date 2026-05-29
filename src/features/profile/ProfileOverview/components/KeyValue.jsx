/** Compact label/value row used across the profile capsules. */
export default function KeyValue({ label, value }) {
  return (
    <div className="po-kv">
      <span className="po-kv-label">{label}</span>
      <span className="po-kv-value">{value ?? '—'}</span>
    </div>
  );
}

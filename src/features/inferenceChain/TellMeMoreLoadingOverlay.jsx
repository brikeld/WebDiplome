/** Skeleton shimmer used while Tell-Me-More content is "loading". */

const DEFAULT_BARS = [
  { height: '22%' },
  { height: '18%' },
  { height: '42%' },
  { height: '12%', solid: true },
];

export default function TellMeMoreLoadingOverlay({ loadingKey, bars = DEFAULT_BARS }) {
  return (
    <div key={loadingKey} className="tell-load" aria-hidden="true">
      {bars.map((bar, idx) => (
        <div
          key={idx}
          className={`tell-load__skel${bar.solid ? ' tell-load__skel--solid' : ''}`}
          style={{ height: bar.height }}
        />
      ))}
    </div>
  );
}

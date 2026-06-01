/** Skeleton shimmer used while Tell-Me-More content is "loading". */

const DEFAULT_BARS = [
  { height: '22%' },
  { height: '18%' },
  { height: '42%' },
  { height: '12%', solid: true },
];

const COMPACT_BARS = [
  { height: '32%' },
  { height: '24%' },
  { height: '16%', solid: true },
];

export default function TellMeMoreLoadingOverlay({
  loadingKey = 'idle',
  bars,
  loop = false,
  compact = false,
}) {
  const resolvedBars = bars ?? (compact ? COMPACT_BARS : DEFAULT_BARS);

  return (
    <div
      key={loadingKey}
      className={`tell-load${loop ? ' tell-load--loop' : ''}${compact ? ' tell-load--compact' : ''}`}
      aria-hidden="true"
    >
      {resolvedBars.map((bar, idx) => (
        <div
          key={idx}
          className={`tell-load__skel${bar.solid ? ' tell-load__skel--solid' : ''}`}
          style={{ height: bar.height }}
        />
      ))}
    </div>
  );
}

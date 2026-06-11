/** Skeleton shimmer used while Tell-Me-More content is "loading". */

const DEFAULT_BARS = [
  { height: '22%' },
  { height: '18%' },
  { height: '42%' },
  { height: '12%', solid: true },
];

const COMPACT_BARS = [{ solid: false }, { solid: false }, { solid: true }];

export const LEADERBOARD_LOAD_BARS = [
  { height: '16%' },
  { height: '24%' },
  { height: '24%' },
  { height: '22%' },
  { solid: true },
];

export default function TellMeMoreLoadingOverlay({
  loadingKey = 'idle',
  bars,
  loop = false,
  compact = false,
  className = '',
  style = undefined,
}) {
  const resolvedBars = bars ?? (compact ? COMPACT_BARS : DEFAULT_BARS);

  return (
    <div
      key={loadingKey}
      className={`tell-load${loop ? ' tell-load--loop' : ''}${compact ? ' tell-load--compact' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
    >
      {resolvedBars.map((bar, idx) => (
        <div
          key={idx}
          className={`tell-load__skel${bar.solid ? ' tell-load__skel--solid' : ''}`}
          style={bar.height ? { height: bar.height } : undefined}
        />
      ))}
    </div>
  );
}

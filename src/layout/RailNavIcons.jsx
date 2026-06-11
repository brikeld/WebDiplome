/** Tabler-style stroke icons for the left nav rail (layout-list + fingerprint). */

function RailIcon({ children, className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function RailFeedIcon({ className = '' }) {
  return (
    <RailIcon className={className}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
      <path d="M9 7l6 0" />
      <path d="M9 11l6 0" />
      <path d="M9 15l4 0" />
    </RailIcon>
  );
}

export function RailProfileIcon({ className = '' }) {
  return (
    <RailIcon className={className}>
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3" />
      <path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6" />
      <path d="M12 11v2" />
      <path d="M12 7v1" />
      <path d="M12 16v.01" />
      <path d="M8 7v.01" />
      <path d="M4 7v.01" />
      <path d="M8 3v.01" />
      <path d="M12 3v.01" />
      <path d="M16 3v.01" />
      <path d="M16 7v.01" />
      <path d="M20 7v.01" />
      <path d="M20 11v.01" />
    </RailIcon>
  );
}

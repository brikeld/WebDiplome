/** Minimal user silhouette — detached circle head + rounded shoulders (default avatar). */
export default function UserSilhouetteIcon({ className = '', ...rest }) {
  const mergedClass = className ? `user-silhouette-icon ${className}` : 'user-silhouette-icon';

  return (
    <svg
      className={mergedClass}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...rest}
    >
      <circle cx="12" cy="7.25" r="3.35" />
      <path d="M5.75 20.25h12.5v-0.35c0-3.18-2.62-5.78-5.86-6.05a7.3 7.3 0 0 0-.64-.03 7.3 7.3 0 0 0-.64.03C8.37 14.12 5.75 16.72 5.75 19.9v.35z" />
    </svg>
  );
}

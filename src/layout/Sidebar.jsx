import { useCallback, useRef } from 'react';
import { RailFeedIcon } from '@/layout/RailNavIcons.jsx';
import UserSilhouetteIcon from '@/features/identity/UserSilhouetteIcon.jsx';

function spawnRipple(buttonEl, event) {
  if (!buttonEl) return;
  const rect = buttonEl.getBoundingClientRect();
  const x = (event?.clientX ?? rect.left + rect.width / 2) - rect.left;
  const y = (event?.clientY ?? rect.top + rect.height / 2) - rect.top;
  const ripple = document.createElement('span');
  ripple.className = 'rail-btn__ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  buttonEl.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 520);
}

function triggerPopAnim(buttonEl) {
  if (!buttonEl) return;
  buttonEl.classList.remove('rail-btn--pop');
  void buttonEl.offsetWidth;
  buttonEl.classList.add('rail-btn--pop');
}

function RailButton({ view, targetView, mainView, label, onSelectView, children }) {
  const btnRef = useRef(null);
  const isActive = mainView === targetView;

  const activate = useCallback(
    (event) => {
      if (isActive) return;
      onSelectView?.(targetView);
      spawnRipple(btnRef.current, event);
      triggerPopAnim(btnRef.current);
    },
    [isActive, onSelectView, targetView],
  );

  return (
    <button
      ref={btnRef}
      type="button"
      className={`rail-btn rail-btn--${view}${isActive ? ' is-active' : ''}`}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate(event);
        }
      }}
    >
      {children}
    </button>
  );
}

export default function Sidebar({ mainView = 'profile', onSelectView }) {
  return (
    <aside className="sidebar" aria-label="Navigation">
      <nav className="icon-rail" aria-label="Main">
        <RailButton
          view="home"
          targetView="home"
          mainView={mainView}
          label="Home"
          onSelectView={onSelectView}
        >
          <RailFeedIcon className="rail-btn__icon" />
        </RailButton>
        <span className="icon-rail__dot" aria-hidden="true" />
        <RailButton
          view="profile"
          targetView="profile"
          mainView={mainView}
          label="Profile"
          onSelectView={onSelectView}
        >
          <UserSilhouetteIcon className="rail-btn__icon rail-btn__icon--profile" />
        </RailButton>
      </nav>
    </aside>
  );
}

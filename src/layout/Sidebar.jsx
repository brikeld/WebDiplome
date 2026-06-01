import UserSilhouetteIcon from '@/features/identity/UserSilhouetteIcon.jsx';

export default function Sidebar({ mainView = 'profile', onSelectView }) {
  return (
    <>
      <aside className="sidebar" aria-label="Navigation">
        <nav className="icon-rail" aria-label="Main">
          <button
            type="button"
            className={`rail-btn rail-btn--home${mainView === 'home' ? ' is-active' : ''}`}
            aria-label="Home"
            aria-current={mainView === 'home' ? 'page' : undefined}
            onClick={() => onSelectView?.('home')}
          >
            <span className="rail-btn__glyph">⌂</span>
          </button>
          <button
            type="button"
            className={`rail-btn rail-btn--profile${mainView === 'profile' ? ' is-active' : ''}`}
            aria-label="Profile"
            aria-current={mainView === 'profile' ? 'page' : undefined}
            onClick={() => onSelectView?.('profile')}
          >
            <UserSilhouetteIcon className="rail-btn__glyph-icon" />
          </button>
        </nav>
      </aside>
    </>
  );
}

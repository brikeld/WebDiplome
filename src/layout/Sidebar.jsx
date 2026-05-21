export default function Sidebar({ mainView = 'profile', onSelectView }) {
  return (
    <>
      <aside className="sidebar" aria-label="Navigation">
        <nav className="icon-rail" aria-label="Main">
          <button
            type="button"
            className={`rail-btn${mainView === 'home' ? ' is-active' : ''}`}
            aria-label="Home"
            aria-current={mainView === 'home' ? 'page' : undefined}
            onClick={() => onSelectView?.('home')}
          >
            ⌂
          </button>
          <button
            type="button"
            className={`rail-btn${mainView === 'profile' ? ' is-active' : ''}`}
            aria-label="Profile"
            aria-current={mainView === 'profile' ? 'page' : undefined}
            onClick={() => onSelectView?.('profile')}
          >
            ⌾
          </button>
        </nav>
      </aside>
    </>
  );
}

export default function Sidebar({ mainView = 'home', onSelectView }) {
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
          <button type="button" className="rail-btn" aria-label="Search">
            ⌕
          </button>
          <button type="button" className="rail-btn" aria-label="DMs">
            ✉
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
          <button type="button" className="rail-btn" aria-label="Badges">
            ★
          </button>
          <button type="button" className="rail-btn" aria-label="Rankings">
            ≡
          </button>
        </nav>
      </aside>
    </>
  );
}

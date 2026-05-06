import { useEffect } from 'react';
import Lenis from 'lenis';
import '../styles/scrollArea.css';

export default function ScrollArea({ children, mode }) {
  useEffect(() => {
    if (mode === 'home' || mode === 'profile') {
      const capsule = document.querySelector('.posts-capsule');
      if (!capsule) return;

      const lenis = new Lenis({
        wrapper: capsule,
        content: capsule.firstElementChild,
        duration: 0.9,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      // Forward wheel events from anywhere on the page into the capsule.
      const onGlobalWheel = (e) => {
        if (capsule.contains(e.target)) return;
        e.preventDefault();
        capsule.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: e.deltaY,
            deltaX: e.deltaX,
            deltaMode: e.deltaMode,
            bubbles: false,
            cancelable: true,
          })
        );
      };
      window.addEventListener('wheel', onGlobalWheel, { passive: false });

      let raf;
      const tick = (t) => { lenis.raf(t); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);

      return () => {
        window.removeEventListener('wheel', onGlobalWheel);
        cancelAnimationFrame(raf);
        lenis.destroy();
      };
    }

    // Other modes (landing, etc) — Lenis on window for free page scroll.
    const lenis = new Lenis({
      duration: 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    window.scrollTo(0, 0);

    let raf;
    const tick = (t) => { lenis.raf(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [mode]);

  return (
    <div className="scroll-area">
      <div className="scroll-area-inner">{children}</div>
    </div>
  );
}

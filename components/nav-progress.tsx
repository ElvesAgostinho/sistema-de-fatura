'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Lightweight top progress bar that animates on route changes so that a tab
 * click produces immediate visual feedback even if the target page is still
 * loading its data.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    // Clear any previous timers.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setActive(true);
    setProgress(12);
    timersRef.current.push(setTimeout(() => setProgress(40), 50));
    timersRef.current.push(setTimeout(() => setProgress(70), 180));
    timersRef.current.push(setTimeout(() => setProgress(90), 400));
    timersRef.current.push(setTimeout(() => setProgress(100), 650));
    timersRef.current.push(setTimeout(() => { setActive(false); setProgress(0); }, 850));

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [pathname]);

  if (!active && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-0.5 pointer-events-none"
      aria-hidden
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_rgba(0,120,212,0.8)] transition-all duration-300 ease-out"
        style={{ width: `${progress}%`, opacity: active ? 1 : 0 }}
      />
    </div>
  );
}

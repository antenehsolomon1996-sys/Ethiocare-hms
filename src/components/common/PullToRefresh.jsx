import { useState, useRef, useEffect } from 'react';

const THRESHOLD = 60;
const MAX_PULL = 100;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullRef = useRef(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const scrollEl = containerRef.current?.parentElement;
    if (!scrollEl) return;

    const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

    const onTouchStart = (e) => {
      if (!isMobile() || refreshing || scrollEl.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    };

    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshing) return;
      const diff = e.touches[0].clientY - startYRef.current;
      if (diff > 0 && scrollEl.scrollTop <= 0) {
        const distance = Math.min(diff * 0.5, MAX_PULL);
        pullRef.current = distance;
        setPullDistance(distance);
      } else if (diff <= 0) {
        pullingRef.current = false;
        pullRef.current = 0;
        setPullDistance(0);
      }
    };

    const onTouchEnd = async () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPullDistance(THRESHOLD);
        pullRef.current = 0;
        try {
          await onRefresh?.();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        pullRef.current = 0;
        setPullDistance(0);
      }
    };

    scrollEl.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: true });
    scrollEl.addEventListener('touchend', onTouchEnd);

    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchmove', onTouchMove);
      scrollEl.removeEventListener('touchend', onTouchEnd);
    };
  }, [refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-full w-full"
      style={{
        transform: `translateY(${pullDistance}px)`,
        transition: pullingRef.current ? 'none' : 'transform 0.2s ease',
      }}
    >
      {(pullDistance > 0 || refreshing) && (
        <div className="flex items-center justify-center py-2">
          <div
            className={`w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full ${refreshing ? 'animate-spin' : ''}`}
          />
        </div>
      )}
      {children}
    </div>
  );
}
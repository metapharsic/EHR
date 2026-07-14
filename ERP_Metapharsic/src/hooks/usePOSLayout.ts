import { useEffect, useState, useRef } from 'react';

export function usePOSLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'full' | 'compact'>('full');

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // Switch to compact mode if width is less than 500px
      setMode(width < 500 ? 'compact' : 'full');
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return { containerRef, mode };
}

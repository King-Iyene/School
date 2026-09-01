import { useEffect, useRef, useState } from 'react';

/**
 * Attaches an IntersectionObserver to the returned ref and flips `visible`
 * to true the first time the element scrolls into view — used to trigger
 * the `animate-brand-fade-up` reveal animation on marketing pages.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

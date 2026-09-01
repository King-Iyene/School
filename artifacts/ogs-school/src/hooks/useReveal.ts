import { useEffect, useRef, useState } from 'react';

/**
 * Attaches an IntersectionObserver to the returned ref and flips `visible`
 * to true the first time the element scrolls into view — used to trigger
 * the `animate-brand-fade-up` reveal animation on marketing pages.
 *
 * This is progressive enhancement only, never a content gate: a generous
 * rootMargin/low threshold fire early (fast scrolls / trackpad flings can
 * otherwise jump an element across the visible range between observer
 * callbacks), and a hard timeout forces `visible` regardless in case the
 * observer never fires at all — content must never stay permanently
 * invisible just because a scroll animation didn't trigger.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.01) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => setVisible(true);
    const fallback = window.setTimeout(reveal, 1800);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
          window.clearTimeout(fallback);
        }
      },
      { threshold, rootMargin: '0px 0px 300px 0px' }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [threshold]);

  return { ref, visible };
}

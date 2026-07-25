import { useEffect, useRef } from 'react';

/**
 * Hook to dynamically load receipt print styles on demand
 * Reduces initial bundle size by lazy-loading print CSS
 */
export function useReceiptStyles() {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('../receipt-print.css', import.meta.url).href;
      document.head.appendChild(link);
      loadedRef.current = true;
    }
  }, []);
}

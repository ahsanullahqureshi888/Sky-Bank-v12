import { useState, useEffect } from 'react';

/**
 * Hook to determine which columns should be visible based on screen size
 * Helps with responsive table design
 */
export function useResponsiveColumns() {
  const [breakpoint, setBreakpoint] = useState('md');
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      if (width < 640) {
        setBreakpoint('xs');
        setIsMobile(true);
        setIsTablet(false);
      } else if (width < 1024) {
        setBreakpoint('sm');
        setIsMobile(false);
        setIsTablet(true);
      } else {
        setBreakpoint('md');
        setIsMobile(false);
        setIsTablet(false);
      }
    };

    // Initial check
    handleResize();

    // Listen for resize
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    breakpoint,
    isMobile,
    isTablet,
    isDesktop: breakpoint === 'md',
  };
}

export default useResponsiveColumns;

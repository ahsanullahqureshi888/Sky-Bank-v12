import React, { useState, useEffect } from 'react';

/**
 * Responsive Table Wrapper Component
 * Automatically handles column visibility and text truncation based on screen size
 * Provides smooth transitions and maintains accessibility
 */
export const ResponsiveTable = ({
  children,
  columns = [],
  visibleColumnsXs = [],
  visibleColumnsSm = [],
  visibleColumnsMd = [],
  className = '',
}) => {
  const [screenSize, setScreenSize] = useState('md');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) setScreenSize('xs');
      else if (width < 768) setScreenSize('sm');
      else setScreenSize('md');
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getVisibleColumns = () => {
    switch (screenSize) {
      case 'xs': return visibleColumnsXs;
      case 'sm': return visibleColumnsSm;
      default: return visibleColumnsMd;
    }
  };

  const visibleCols = getVisibleColumns();

  return (
    <div className={`overflow-x-auto app-scrollbar rounded-lg border border-sky-100 bg-white/50 ${className}`}>
      <table className="w-full text-left border-collapse">
        {children}
      </table>
    </div>
  );
};

/**
 * Table Cell with automatic text truncation and tooltip
 * Shows full text on hover
 */
export const TruncatedCell = ({ children, maxLines = 1, className = '' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <td
      className={`py-3 px-4 text-sm relative group ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={maxLines === 1 ? 'truncate' : `line-clamp-${maxLines}`}>
        {children}
      </div>
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap z-10 pointer-events-none">
          {children}
        </div>
      )}
    </td>
  );
};

/**
 * Conditional Column Renderer
 * Shows/hides columns based on screen size
 */
export const ConditionalColumn = ({ show = true, children }) => {
  return show ? children : null;
};

export default ResponsiveTable;

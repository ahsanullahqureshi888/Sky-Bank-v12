import React from 'react';

/**
 * Accessible icon button component with proper ARIA labels and focus management
 * Ensures keyboard navigation and screen reader support
 */
export const AccessibleIconButton = ({
  Icon,
  label,
  title,
  onClick,
  disabled = false,
  className = '',
  ariaLabel,
  size = 20,
  ...props
}) => {
  const ariaLabelText = ariaLabel || label || title;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring inline-flex items-center justify-center transition-smooth ${className}`}
      aria-label={ariaLabelText}
      title={title || ariaLabelText}
      {...props}
    >
      <Icon size={size} strokeWidth={2} />
    </button>
  );
};

export default AccessibleIconButton;

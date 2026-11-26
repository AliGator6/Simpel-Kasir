import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

const SIZE_CLASSES: Record<number, string> = {
  34: 'h-[34px] w-[34px]',
  42: 'h-[42px] w-[42px]',
  46: 'h-[46px] w-[46px]',
  48: 'h-12 w-12',
};

export const SimpelKasirLogo: React.FC<LogoProps> = ({ size = 48, className = '' }) => {
  const sizeClass = SIZE_CLASSES[size] || 'h-12 w-12';
  return (
    <img
      src="/app-icon.png"
      alt="Logo SimpelKasir"
      width={size}
      height={size}
      draggable={false}
      className={`${sizeClass} shrink-0 rounded-xl object-cover shadow-xs select-none ${className}`.trim()}
    />
  );
};


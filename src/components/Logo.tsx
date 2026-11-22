import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export const SimpelKasirLogo: React.FC<LogoProps> = ({ size = 48, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logo SimpelKasir"
    >
      <rect width="120" height="120" rx="28" fill="#132622" />
      <path d="M22 44H52L46 53H18L22 44Z" fill="#B48E48" />
      <path d="M16 61H46L41 70H13L16 61Z" fill="#D2B06F" />
      <path
        d="M56 28H90C94.4183 28 98 31.5817 98 36V90L89 83L81 90L73 83L65 90L56 83V28Z"
        fill="#F5F6F4"
      />
      <path d="M80 41L68 60H78L74 76L88 56H78L80 41Z" fill="#165B49" />
    </svg>
  );
};

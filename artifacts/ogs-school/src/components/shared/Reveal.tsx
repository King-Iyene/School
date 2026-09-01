import { ReactNode } from 'react';
import { useReveal } from '../../hooks/useReveal';

interface RevealProps {
  children: ReactNode;
  /** Stagger delay in ms, applied via inline style so Tailwind doesn't need to purge dynamic classes. */
  delay?: number;
  className?: string;
}

/** Fades + slides children up the first time they scroll into view. */
export default function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`${visible ? 'animate-brand-fade-up' : 'opacity-0'} ${className}`}
      style={{ animationDelay: visible ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}

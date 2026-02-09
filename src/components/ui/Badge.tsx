import { ReactNode } from 'react';

interface BadgeProps {
  variant: 'flair' | 'ai' | 'mod' | 'nsfw' | 'spoiler';
  children?: ReactNode;
  className?: string;
}

export default function Badge({ variant, children, className = '' }: BadgeProps) {
  const baseClasses = "font-bold rounded-sm uppercase tracking-wide";
  
  const variantStyles = {
    flair: "bg-base-300 text-base-content text-xs px-2 py-0.5 rounded-full font-medium normal-case tracking-normal",
    ai: "bg-info/10 text-info text-[10px] px-1.5 py-0.5",
    mod: "bg-success/20 text-success text-[10px] px-1.5 py-0.5",
    nsfw: "bg-error/20 text-error text-[10px] px-1.5 py-0.5",
    spoiler: "bg-base-300 text-base-content/70 text-[10px] px-1.5 py-0.5",
  };

  const textContent = {
    flair: children,
    ai: "AI",
    mod: "MOD",
    nsfw: "NSFW",
    spoiler: "SPOILER",
  };

  return (
    <span className={`${variant === 'flair' ? '' : baseClasses} ${variantStyles[variant]} ${className}`}>
      {textContent[variant]}
    </span>
  );
}

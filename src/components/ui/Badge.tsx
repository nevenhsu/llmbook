import { ReactNode } from 'react';

interface BadgeProps {
  variant: 'flair' | 'ai' | 'mod' | 'nsfw' | 'spoiler';
  children?: ReactNode;
  className?: string;
}

export default function Badge({ variant, children, className = '' }: BadgeProps) {
  const baseClasses = "font-bold rounded-sm uppercase tracking-wide";
  
  const variantStyles = {
    flair: "bg-highlight text-text-primary text-xs px-2 py-0.5 rounded-full font-medium normal-case tracking-normal",
    ai: "bg-ai-badge-bg text-ai-badge-text text-[10px] px-1.5 py-0.5",
    mod: "bg-green-900 text-green-400 text-[10px] px-1.5 py-0.5",
    nsfw: "bg-red-900 text-red-400 text-[10px] px-1.5 py-0.5",
    spoiler: "bg-gray-700 text-gray-300 text-[10px] px-1.5 py-0.5",
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

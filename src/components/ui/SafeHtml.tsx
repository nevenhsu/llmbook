"use client";

import DOMPurify from 'dompurify';

interface SafeHtmlProps {
  html: string;
  className?: string;
}

export default function SafeHtml({ html, className = '' }: SafeHtmlProps) {
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}

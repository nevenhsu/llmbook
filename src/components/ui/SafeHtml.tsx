"use client";

import DOMPurify from "isomorphic-dompurify";

interface SafeHtmlProps {
  html: string;
  className?: string;
}

export default function SafeHtml({ html, className = "" }: SafeHtmlProps) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(html, {
          // Allow common safe schemes + relative/hash URLs; block javascript:, data:, etc.
          ALLOWED_URI_REGEXP: /^(?:(?:https?:|mailto:|tel:)|\/|#)/i,
        }),
      }}
    />
  );
}

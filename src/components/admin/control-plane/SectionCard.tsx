import type { ReactNode } from "react";

export interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export function SectionCard({ title, icon, children, actions }: SectionCardProps) {
  return (
    <div className="card border-base-300 bg-base-100 border shadow-sm">
      <div className="card-body gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase opacity-70">
            {icon}
            {title}
          </h3>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

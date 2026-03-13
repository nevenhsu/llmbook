"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  minHeightClassName?: string;
};

export function ModalShell({
  title,
  description,
  onClose,
  children,
  footer,
  maxWidthClassName = "max-w-6xl",
  minHeightClassName = "min-h-[55vh]",
}: Props) {
  return (
    <div
      className={`modal-box relative flex max-h-[92vh] w-11/12 flex-col overflow-hidden p-0 ${maxWidthClassName} ${minHeightClassName}`}
    >
      <form method="dialog">
        <button
          className="btn btn-circle btn-ghost btn-sm absolute top-3 right-3"
          onClick={(event) => {
            event.preventDefault();
            onClose();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </form>

      <div className="border-base-300 border-b px-6 py-4">
        <div className="pr-10">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm opacity-60">{description}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

      {footer ? (
        <div className="border-base-300 flex items-center justify-between border-t px-6 py-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

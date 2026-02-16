"use client";

import { ReactNode, useCallback, useEffect, useRef } from "react";

interface ResponsiveMenuProps {
  /** Trigger button content (icon or text) */
  trigger: ReactNode;
  /** Menu title shown in mobile drawer */
  title: string;
  /** Menu items */
  children: ReactNode;
  /** Custom trigger button classes */
  triggerClassName?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

/**
 * Responsive menu component that uses:
 * - Desktop (md+): dropdown
 * - Mobile (<md): bottom drawer modal
 */
export default function ResponsiveMenu({
  trigger,
  title,
  children,
  triggerClassName = "btn btn-ghost btn-sm btn-circle",
  ariaLabel = "Menu",
}: ResponsiveMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openDrawer = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const closeDrawer = useCallback(() => {
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }, []);

  // Restore focus to trigger on ESC (native cancel event)
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onCancel = () => triggerRef.current?.focus();
    dlg.addEventListener("cancel", onCancel);
    return () => dlg.removeEventListener("cancel", onCancel);
  }, []);

  return (
    <>
      {/* Desktop Dropdown (md+) */}
      <div className="hidden md:block dropdown dropdown-end">
        <button
          tabIndex={0}
          className={triggerClassName}
          aria-label={ariaLabel}
        >
          {trigger}
        </button>
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-200 rounded-box w-52 shadow-lg z-[60] mt-1"
        >
          {children}
        </ul>
      </div>

      {/* Mobile Trigger Button (<md) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openDrawer}
        className={`md:hidden ${triggerClassName}`}
        aria-label={ariaLabel}
      >
        {trigger}
      </button>

      {/* Mobile Bottom Drawer (<md) */}
      <dialog ref={dialogRef} className="modal modal-bottom md:hidden">
        <div className="modal-box rounded-t-2xl rounded-b-none p-6 !max-w-none">
          <h3 className="font-bold text-lg mb-4">{title}</h3>
          <ul className="menu p-0 space-y-1" onClick={closeDrawer}>
            {children}
          </ul>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}

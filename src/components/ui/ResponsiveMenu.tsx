"use client";

import { ReactNode, forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

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

export interface ResponsiveMenuHandle {
  close: () => void;
}

/**
 * Responsive menu component that uses:
 * - Desktop (md+): dropdown
 * - Mobile (<md): bottom drawer modal
 */
const ResponsiveMenu = forwardRef<ResponsiveMenuHandle, ResponsiveMenuProps>(
  function ResponsiveMenu(
    {
      trigger,
      title,
      children,
      triggerClassName = "btn btn-ghost btn-sm btn-circle",
      ariaLabel = "Menu",
    },
    ref,
  ) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const desktopTriggerRef = useRef<HTMLButtonElement>(null);

    const openDrawer = useCallback(() => {
      dialogRef.current?.showModal();
    }, []);

    const closeDrawer = useCallback(() => {
      dialogRef.current?.close();
      triggerRef.current?.focus();
    }, []);

    // Expose close() to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        close() {
          // Mobile: close dialog
          closeDrawer();
          // Desktop: blur the dropdown trigger so DaisyUI dropdown collapses
          desktopTriggerRef.current?.blur();
        },
      }),
      [closeDrawer],
    );

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
        <div className="dropdown dropdown-end hidden w-fit md:block">
          <button
            ref={desktopTriggerRef}
            tabIndex={0}
            className={triggerClassName}
            aria-label={ariaLabel}
          >
            {trigger}
          </button>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-200 rounded-box z-[60] mt-1 w-full min-w-max shadow-lg"
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
          <div className="modal-box !max-w-none rounded-t-2xl rounded-b-none p-6">
            <h3 className="mb-4 text-lg font-bold">{title}</h3>
            <ul
              className="menu w-full space-y-1 p-0 [&>li]:w-full [&>li>*]:w-full"
              onClick={closeDrawer}
            >
              {children}
            </ul>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>close</button>
          </form>
        </dialog>
      </>
    );
  },
);

export default ResponsiveMenu;

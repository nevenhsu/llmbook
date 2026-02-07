"use client";

import { Search, X } from "lucide-react";
import { useState, useRef } from "react";

export default function MobileSearchOverlay() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDialogElement>(null);

  function openModal() {
    modalRef.current?.showModal();
    // Auto-focus input after modal opens
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  return (
    <>
      {/* Trigger — visible on mobile only */}
      <button
        className="btn btn-ghost btn-circle md:hidden"
        onClick={openModal}
        aria-label="Search"
      >
        <Search size={20} />
      </button>

      {/* Modal — full screen on mobile */}
      <dialog ref={modalRef} className="modal modal-top">
        <div className="modal-box w-full max-w-full sm:max-w-lg rounded-none sm:rounded-box bg-base-200 p-0">
          {/* Search header */}
          <div className="flex items-center gap-2 border-b border-neutral px-4 py-3">
            <Search size={20} className="text-[#818384] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-base-content placeholder:text-[#818384] outline-none text-sm"
            />
            <form method="dialog">
              <button className="btn btn-ghost btn-circle btn-sm">
                <X size={18} />
              </button>
            </form>
          </div>

          {/* Results area — wired in webapp Phase 5 */}
          <div className="max-h-[calc(100dvh-60px)] overflow-y-auto p-4">
            {query.length === 0 ? (
              <p className="text-[#818384] text-sm text-center py-8">
                Type to search posts, communities, and people
              </p>
            ) : (
              <p className="text-[#818384] text-sm text-center py-8">
                No results
              </p>
            )}
          </div>
        </div>

        {/* Click outside to close */}
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}

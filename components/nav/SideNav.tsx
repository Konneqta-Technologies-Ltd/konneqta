"use client";

import DeleteAccountButton from "./DeleteAccountButton";
import InstallAppButton from "./InstallAppButton";
import LogoutButton from "./LogoutButton";
import { useEffect } from "react";

/**
 * Slide-out side navigation drawer.
 *
 * Slides in from the left with a dark backdrop overlay. The three action
 * buttons are stacked at the bottom of the drawer.
 *
 * Closes on: backdrop click, Escape key, or button activation (each button
 * handles its own routing).
 */
export default function SideNav({
  open,
  onClose,
  isAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
}) {
  // Close on Escape key.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* ---- Backdrop ---- */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ---- Drawer ---- */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-full w-72 max-w-[80vw] flex-col border-r border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigation menu"
        aria-hidden={!open}
      >
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="cursor-pointer rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ---- Spacer (pushes buttons to bottom) ---- */}
        <div className="flex-1" />

        {/* ---- Action buttons (bottom, stacked) ---- */}
        <div className="space-y-3 border-t border-zinc-200 p-5 dark:border-zinc-800">
          <InstallAppButton />
          {isAuthenticated && (
            <>
              <LogoutButton />
              <DeleteAccountButton />
            </>
          )}
        </div>
      </aside>
    </>
  );
}
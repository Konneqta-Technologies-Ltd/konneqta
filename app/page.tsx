'use client';

import DarkModeToggle from "@/components/DarkModeToggle";
import Link from "next/link";
import SignInWithGoogle from "@/components/SignInWithGoogle";
import dynamic from "next/dynamic";
import { useFlutterwavePayment } from "@/hooks/useFlutterwavePayment";
import { useState } from "react";

// Lazy-load the scanner only when the user opens it.
// html5-qrcode (~30KB) stays out of the main bundle.
const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

export default function Home() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const { pay } = useFlutterwavePayment();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <DarkModeToggle />
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        Connect Smarter, Beyond The Internet
      </h1>
      <div className="mt-6 flex-col items-center justify-center space-y-4">
         <p className="border py-2 text-center px-4 hover:bg-black hover:text-white dark:border-white rounded-4xl cursor-pointer dark:text-white">
          <Link href="/auth/signup">
            Sign Up
          </Link>
        </p>
        <p className="border py-2 text-center px-4 hover:bg-black hover:text-white dark:border-white rounded-4xl cursor-pointer dark:text-white">
          <Link href="/auth/login">
            Login
          </Link>
        </p>
        <SignInWithGoogle />
        <button
      onClick={() => pay("premium_upgrade")}
      className="rounded bg-blue-600 px-4 py-2 text-white"
    >
      Test Flutterwave
    </button>

        {/* QR Scan button — available to all visitors on the home page */}
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="flex items-center justify-center gap-2 border py-2 text-center px-4 hover:bg-black hover:text-white dark:border-white rounded-4xl cursor-pointer dark:text-white w-full"
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
            <rect width="5" height="5" x="3" y="3" rx="1" />
            <rect width="5" height="5" x="16" y="3" rx="1" />
            <rect width="5" height="5" x="3" y="16" rx="1" />
            <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
            <path d="M21 21v.01" />
            <path d="M12 7v3a2 2 0 0 1-2 2H7" />
            <path d="M3 12h.01" />
            <path d="M12 3h.01" />
            <path d="M12 16v.01" />
            <path d="M16 12h1" />
            <path d="M21 12v.01" />
            <path d="M12 21v-1" />
          </svg>
          <span>Scan QR Code</span>
        </button>

      </div>

      {/* QR Scanner — lazy-loaded, opens full-screen */}
      {scannerOpen && (
        <QrScanner onClose={() => setScannerOpen(false)} />
      )}
    </main>
  );
}

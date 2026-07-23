"use client";

import { extractKonneqtaPath, isKonneqtaUrl } from "@/lib/url-validation";
import { useEffect, useRef, useState } from "react";

import { useTrack } from "@/lib/use-track";

/**
 * Minimal type for the html5-qrcode scanner instance (avoids importing the
 * library at module level — we lazy-load it only when the scanner opens).
 */
type ScannerInstance = {
  start: (
    camera: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number }; aspectRatio: number },
    onSuccess: (decodedText: string) => void,
    onError: (err: unknown) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
};

/**
 * QrScanner — full-screen camera scanner for Konneqta-to-Konneqta connections.
 *
 * SECURITY
 * --------
 * Every decoded string is passed through isKonneqtaUrl() before navigation.
 * Anything that isn't a Konneqta URL is rejected with "Not a Konneqta QR
 * code" — this prevents a malicious printed QR from using the scanner as a
 * phishing launcher.
 */
export default function QrScanner({ onClose }: { onClose: () => void }) {
  const track = useTrack();
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const scannerInstanceRef = useRef<ScannerInstance | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  // startedRef = true only AFTER scanner.start() resolves; prevents calling
  // stop() on a scanner that never entered SCANNING (the "Cannot stop,
  // scanner is not running or paused" error).
  const startedRef = useRef<boolean>(false);
  // stoppingRef guards against double stop() (e.g. onDecode + unmount cleanup).
  const stoppingRef = useRef<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Safe teardown of the scanner. No-ops if the scanner was never started,
   * is already stopping, or throws — so it can be called from both the
   * decode-success path and the useEffect cleanup without races.
   */
  const stopScanner = () => {
    const sc = scannerInstanceRef.current;
    if (!sc || stoppingRef.current || !startedRef.current) return;
    stoppingRef.current = true;
    startedRef.current = false;
    try {
      sc.stop()
        .then(() => {
          try {
            sc.clear();
          } catch {
            /* clear() best-effort */
          }
        })
        .catch(() => {
          /* already stopped — ignore */
        })
        .finally(() => {
          stoppingRef.current = false;
        });
    } catch {
      // Synchronous throw from html5-qrcode (some versions reject
      // synchronously). Swallow and best-effort clear.
      stoppingRef.current = false;
      try {
        sc.clear();
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    // The decode handler — defined INSIDE useEffect to avoid forward-reference.
    const onDecode = (decodedText: string) => {
      // Debounce: ignore decodes within 2s of the last successful one
      const now = Date.now();
      if (now - lastScanTimeRef.current < 2000) return;

      // SECURITY GATE: only accept Konneqta URLs
      if (!isKonneqtaUrl(decodedText)) {
        setNotice("Not a Konneqta QR code. Try again.");
        setTimeout(() => setNotice(null), 3000);
        return;
      }

      const path = extractKonneqtaPath(decodedText);
      if (!path) {
        setNotice("Not a Konneqta QR code. Try again.");
        setTimeout(() => setNotice(null), 3000);
        return;
      }

      // Success — record, stop scanner, navigate
      lastScanTimeRef.current = now;
      track("profile_scanned", { scanned: path });

      // Stop camera before navigating (releases it ASAP)
      stopScanner();

      // Full document navigation (not router.push) so the request is a true
      // navigation — this ensures the service worker's NetworkFirst strategy
      // + /offline fallback apply, instead of an RSC fetch that bypasses them
      // and fails hard on flaky networks (ERR_INTERNET_DISCONNECTED).
      window.location.assign(`/${path}`);
      onClose();
    };

    // Dynamic import — lazy-loads the library only when scanner opens.
    import("html5-qrcode")
      .then(({ Html5Qrcode }) => {
        if (!mounted || !scannerRef.current) return;

        const scanner = new Html5Qrcode("qr-reader", {
          formatsToSupport: [0], // QR_CODE
          verbose: false,
        }) as unknown as ScannerInstance;
        scannerInstanceRef.current = scanner;

        scanner
          .start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            onDecode,
            () => {
              // Per-frame error — ignore (noise during scanning)
            }
          )
          .then(() => {
            // Only now is the scanner actually in SCANNING state.
            startedRef.current = true;
            // If the component unmounted while start() was in flight, stop
            // immediately to release the camera.
            if (!mounted) {
              stopScanner();
            }
          })
          .catch((err: unknown) => {
            console.error("QR scanner start error:", err);
            const msg = err instanceof Error ? err.message : String(err);
            if (
              msg.toLowerCase().includes("permission") ||
              msg.toLowerCase().includes("denied")
            ) {
              setPermissionDenied(true);
            } else {
              setError("Could not access camera. " + msg);
            }
          });
      })
      .catch((err: unknown) => {
        console.error("Failed to load scanner library:", err);
        setError("Failed to load scanner. Check your connection.");
      });

    return () => {
      mounted = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    setPermissionDenied(false);
    setError(null);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm font-medium text-white">Scan a Konneqta QR</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="cursor-pointer rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Camera viewfinder / messages */}
      <div className="relative flex flex-1 items-center justify-center px-4">
        {permissionDenied ? (
          <div className="text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 opacity-60">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
            <p className="text-sm text-white/80">Camera access is needed to scan QR codes.</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 cursor-pointer rounded-lg bg-white px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-sm text-white/80">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 cursor-pointer rounded-lg bg-white px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* The html5-qrcode library mounts the video here */}
            <div id="qr-reader" ref={scannerRef} className="w-full max-w-md overflow-hidden rounded-2xl" />

            {/* Instruction overlay */}
            {!notice && (
              <p className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center text-xs text-white/50">
                Point your camera at a Konneqta QR code
              </p>
            )}

            {/* "Not a Konneqta QR" notice */}
            {notice && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-red-500/90 px-4 py-2 text-center text-xs font-medium text-white">
                {notice}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
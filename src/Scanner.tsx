import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef } from "react";

/**
 * Skaner kodów (kolczyki UHF / kody QR z dokumentów).
 * Wołany callback z surowym odczytem; formatowaniem zajmuje się formularz.
 */
export function Scanner({
  onScan,
  onClose,
}: {
  onScan: (raw: string) => void;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let stopped = false;
    const scanner = new Html5Qrcode("scanner-box", {
      verbose: false,
      formatsToSupport: undefined,
    });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 180 } },
        (decoded) => {
          if (stopped) return;
          stopped = true;
          onScan(decoded);
          void scanner.stop().catch(() => {});
        },
        () => {}, // błędy klatek ignorujemy
      )
      .catch((err) => console.error("scanner start failed", err));

    return () => {
      stopped = true;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current?.clear();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="font-semibold">Skanuj kolczyk</span>
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5">
          Zamknij
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <div id="scanner-box" ref={boxRef} className="mx-auto w-full max-w-md" />
      </div>
      <p className="p-4 text-center text-sm text-white/70">
        Najedź na kod z numerem PL… — odczyt wpisze się automatycznie.
      </p>
    </div>
  );
}

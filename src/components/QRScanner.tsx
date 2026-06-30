import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
}

export default function QRScanner({ onScanSuccess, onScanFailure }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const lastScan = useRef<{ text: string; time: number }>({ text: '', time: 0 });

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    
    scannerRef.current.render((decodedText) => {
      const now = Date.now();
      if (lastScan.current.text !== decodedText || now - lastScan.current.time > 3000) {
        lastScan.current = { text: decodedText, time: now };
        onScanSuccess(decodedText);
      }
    }, (error) => {
      if (onScanFailure) {
        onScanFailure(error);
      }
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [onScanSuccess, onScanFailure]);

  return <div id="qr-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl bg-white" />;
}

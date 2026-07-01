import React, { useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: any) => void;
}

export default function QRScanner({ onScanSuccess, onScanFailure }: QRScannerProps) {
  const lastScan = useRef<{ text: string; time: number }>({ text: '', time: 0 });

  return (
    <div className="w-full h-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
      <Scanner 
        onScan={(result) => {
          if (result && result.length > 0) {
            const decodedText = result[0].rawValue;
            const now = Date.now();
            if (lastScan.current.text !== decodedText || now - lastScan.current.time > 3000) {
              lastScan.current = { text: decodedText, time: now };
              onScanSuccess(decodedText);
            }
          }
        }}
        onError={(error) => {
          if (onScanFailure) {
            onScanFailure(error);
          }
        }}
        components={{
          audio: false,
          finder: false,
        }}
        styles={{
          container: {
            width: '100%',
            height: '100%',
            aspectRatio: '1',
          }
        }}
      />
    </div>
  );
}

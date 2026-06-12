import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import React, { useEffect, useRef } from 'react';

export interface WebQrScannerProps {
  onScan: (text: string) => void;
}

/**
 * Web camera QR scanner (react-native-web runs on react-dom, so a raw
 * <video> host element renders a real webcam preview). Uses @zxing/browser
 * to decode QR codes from the live stream. Requires localhost or HTTPS.
 */
export default function WebQrScanner({ onScan }: WebQrScannerProps) {
  const videoRef = useRef<any>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const last = useRef<{ data: string; at: number }>({ data: '', at: 0 });

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserQRCodeReader();

    void (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (!result) return;
          const text = result.getText();
          const now = Date.now();
          // Ignore the same code re-read within 3s.
          if (text === last.current.data && now - last.current.at < 3000) return;
          last.current = { data: text, at: now };
          onScan(text);
        });
        if (stopped) controls.stop();
        else controlsRef.current = controls;
      } catch {
        // Camera permission denied / unavailable — paste fallback stays.
      }
    })();

    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
  }, [onScan]);

  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    muted: true,
    playsInline: true,
    style: { width: '100%', height: '100%', objectFit: 'cover' },
  });
}

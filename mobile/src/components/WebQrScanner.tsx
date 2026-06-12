// Native stub — the camera scanner on native is expo-camera's CameraView.
// Metro picks WebQrScanner.web.tsx on web instead of this file.
export interface WebQrScannerProps {
  onScan: (text: string) => void;
}

export default function WebQrScanner(_props: WebQrScannerProps): null {
  return null;
}

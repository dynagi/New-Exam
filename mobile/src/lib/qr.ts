import QRCode from 'qrcode';

/**
 * Generate a QR code as an SVG string. `qrcode`'s SVG renderer is pure JS
 * (no canvas/DOM), so the same call works on web and native — the SVG can
 * be displayed with react-native-svg's SvgXml or inlined into print HTML.
 */
export async function qrSvg(payload: string, size = 140): Promise<string> {
  return QRCode.toString(payload, {
    type: 'svg',
    margin: 1,
    width: size,
    errorCorrectionLevel: 'M',
  });
}

import * as DocumentPicker from 'expo-document-picker';

export interface PickedPdf {
  base64: string; // raw base64 (no data: prefix)
  name: string;
  size: number;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      // strip the "data:application/pdf;base64," prefix
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Cross-platform PDF picker. Returns the file as base64 (web + native) or
 * null if the user cancelled. Uses fetch+FileReader, which works for both
 * web blob URLs and native file URIs in Expo.
 */
export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const res = await fetch(asset.uri);
  const blob = await res.blob();
  const base64 = await blobToBase64(blob);

  return {
    base64,
    name: asset.name ?? 'questions.pdf',
    size: asset.size ?? blob.size ?? 0,
  };
}

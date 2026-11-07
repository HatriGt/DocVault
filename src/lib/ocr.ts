/**
 * Pluggable on-device OCR. Text recognition requires a native model
 * (Google ML Kit on Android, Apple Vision on iOS) which is not part of the
 * Expo SDK. A provider can be registered at startup, e.g. with
 * `@react-native-ml-kit/text-recognition` in a development build:
 *
 *   registerOcrProvider(async (uri) => (await TextRecognition.recognize(uri)).text);
 *
 * Without a provider, classification falls back to filename heuristics.
 * Images never leave the device for OCR.
 */
type Provider = (imageUri: string) => Promise<string>;
let provider: Provider | null = null;

export function registerOcrProvider(p: Provider) {
  provider = p;
}

export const ocrAvailable = () => provider != null;

export async function recognizeText(imageUri: string): Promise<string> {
  if (!provider) return '';
  try {
    return await provider(imageUri);
  } catch {
    return '';
  }
}

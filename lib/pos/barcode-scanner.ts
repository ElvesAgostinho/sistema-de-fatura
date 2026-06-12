/**
 * Barcode Scanner Detection
 *
 * Hardware barcode scanners act as HID keyboards but type extremely fast
 * (< 30ms between characters). This hook detects that pattern and fires
 * a callback when a full barcode is scanned, distinguishing from manual input.
 */

const SCANNER_CHAR_INTERVAL_MS = 50;   // scanners type faster than this
const MIN_BARCODE_LENGTH = 4;

export interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  onPartial?: (partial: string) => void;
}

export function createBarcodeListener(options: BarcodeScannerOptions) {
  let buffer = '';
  let lastKeyTime = 0;

  function handleKeyDown(e: KeyboardEvent) {
    // Only capture printable chars or Enter
    if (e.key === 'Enter') {
      if (buffer.length >= MIN_BARCODE_LENGTH) {
        options.onScan(buffer.trim());
      }
      buffer = '';
      return;
    }

    // Ignore modifier keys and non-printable
    if (e.key.length !== 1) return;

    const now = Date.now();
    const delta = now - lastKeyTime;
    lastKeyTime = now;

    // If gap is too large → reset buffer (manual typing)
    if (delta > 300 && buffer.length > 0) {
      buffer = '';
    }

    buffer += e.key;
    options.onPartial?.(buffer);
  }

  return {
    attach: () => window.addEventListener('keydown', handleKeyDown, true),
    detach: () => window.removeEventListener('keydown', handleKeyDown, true),
  };
}

/**
 * Detect if an input value was likely typed by a barcode scanner
 * based on the typing speed (used in onChange handlers).
 */
export function isLikelyScannerInput(value: string, durationMs: number): boolean {
  if (value.length < MIN_BARCODE_LENGTH) return false;
  const avgMsPerChar = durationMs / value.length;
  return avgMsPerChar < SCANNER_CHAR_INTERVAL_MS;
}

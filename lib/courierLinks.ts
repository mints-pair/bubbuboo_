// Thailand Post's tracking URL follows a verified, stable query-param
// format, so we can safely auto-generate a link when the admin has typed
// some recognizable variant of "ไปรษณีย์ไทย" / "Thailand Post" into the
// carrier field. For every other carrier, we can't be confident of the
// correct URL shape, so the admin attaches a link manually instead.
const THAILAND_POST_PATTERNS = ['ไปรษณีย์ไทย', 'ปณไทย', 'ปณ.ไทย', 'ปณ ไทย', 'thailandpost', 'thailand post'];

export function isThailandPost(carrier: string | null | undefined): boolean {
  if (!carrier) return false;
  const normalized = carrier.toLowerCase().replace(/\s+/g, '');
  return THAILAND_POST_PATTERNS.some((p) => normalized.includes(p.toLowerCase().replace(/\s+/g, '')));
}

export function getCourierTrackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined, manualUrl: string | null | undefined): string | null {
  if (isThailandPost(carrier) && trackingNumber) {
    return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(trackingNumber)}`;
  }
  return manualUrl || null;
}

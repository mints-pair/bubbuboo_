// A stable per-browser id used to identify "this bidder" across an auction's
// lifetime, without requiring login — same pattern as the cart session id.
const SESSION_KEY = 'shop_bid_session_v1';
export function getBidSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const BIDDER_INFO_KEY = 'shop_bidder_info_v1';
export type BidderInfo = { name: string; contact: string };

export function getSavedBidderInfo(): BidderInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BIDDER_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBidderInfo(info: BidderInfo) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BIDDER_INFO_KEY, JSON.stringify(info));
}

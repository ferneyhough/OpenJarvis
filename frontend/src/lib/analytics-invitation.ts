const ANALYTICS_SEEN_KEY = 'openjarvis-analytics-choice-seen';

interface AnalyticsInvitation {
  ready: boolean;
  sharingModalSeen: boolean;
  markSharingModalSeen: () => void;
}

/** Suppress the legacy launch dialog while preserving the existing seen state. */
export function markAnalyticsChoiceSeen({
  ready, sharingModalSeen, markSharingModalSeen,
}: AnalyticsInvitation): void {
  if (!ready) return;
  if (!sharingModalSeen) markSharingModalSeen();
  localStorage.setItem(ANALYTICS_SEEN_KEY, 'true');
}

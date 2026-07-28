export type SmokeLifecyclePresentation = {
  opacity: number;
  scale: number;
};

export const SMOKE_FIELD_SIZE = {
  height: 88,
  width: 106,
} as const;

export const SMOKE_LIFETIME_RING = {
  backdropWidth: 6,
  radius: 20,
  width: 4.4,
} as const;

export function resolveSmokeLifecyclePresentation(
  activeAgeSeconds: number | null,
  remainingSeconds: number | null,
): SmokeLifecyclePresentation {
  const age = activeAgeSeconds == null ? 1 : Math.max(0, activeAgeSeconds);
  const remaining = remainingSeconds == null ? 2 : Math.max(0, remainingSeconds);
  const bloom = Math.min(1, 0.2 + age / 0.55);
  const fade = Math.min(1, remaining / 1.1);

  return {
    opacity: Math.max(0, Math.min(bloom, fade)),
    scale: Math.min(1, 0.68 + age / 1.6),
  };
}

export function resolveSmokeLifetimeProgress(
  remainingSeconds: number | null,
  activeDurationSeconds: number | null,
) {
  if (remainingSeconds == null || activeDurationSeconds == null || activeDurationSeconds <= 0) {
    return null;
  }

  return Math.max(0, Math.min(1, remainingSeconds / activeDurationSeconds));
}

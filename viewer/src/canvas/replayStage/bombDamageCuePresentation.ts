export const BOMB_FIELD_CUE_SECONDS = 3.6;

const ATTACK_SECONDS = 0.12;
const HOLD_END_SECONDS = 1.4;

export function resolveBombFieldCueAlpha(eventAgeSeconds: number) {
  if (eventAgeSeconds < 0 || eventAgeSeconds > BOMB_FIELD_CUE_SECONDS) {
    return 0;
  }

  if (eventAgeSeconds < ATTACK_SECONDS) {
    const attackProgress = eventAgeSeconds / ATTACK_SECONDS;
    const easedAttack = 1 - (1 - attackProgress) ** 3;
    return 0.38 + easedAttack * 0.56;
  }

  if (eventAgeSeconds <= HOLD_END_SECONDS) {
    const holdProgress = (eventAgeSeconds - ATTACK_SECONDS) / (HOLD_END_SECONDS - ATTACK_SECONDS);
    return 0.94 - holdProgress * 0.08;
  }

  const fadeProgress =
    (eventAgeSeconds - HOLD_END_SECONDS) / (BOMB_FIELD_CUE_SECONDS - HOLD_END_SECONDS);
  return 0.86 * (1 - fadeProgress) ** 1.15;
}

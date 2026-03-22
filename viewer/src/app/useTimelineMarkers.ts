import { useMemo } from "react";

import { buildTimelineMarkers } from "../replay/timeline";
import type { Replay } from "../replay/types";
import type { UtilityFocus } from "../replay/utilityFilter";

export function useTimelineMarkers(
  replay: Replay | null,
  round: Replay["rounds"][number] | null,
  utilityFocus: UtilityFocus,
) {
  return useMemo(() => buildTimelineMarkers(replay, round, utilityFocus), [replay, round, utilityFocus]);
}

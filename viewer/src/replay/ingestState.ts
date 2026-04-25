export type DemoIngestStep = "upload" | "parser" | "validate" | "index" | "save";

export type DemoIngestState = {
  fileName: string;
  mapName: string | null;
  roundsIndexed: number;
  roundsTotal: number | null;
  step: DemoIngestStep;
};

export const demoIngestSteps: DemoIngestStep[] = ["upload", "parser", "validate", "index", "save"];

export function demoIngestStepLabel(step: DemoIngestStep) {
  switch (step) {
    case "upload":
      return "Upload";
    case "parser":
      return "Process";
    case "validate":
      return "Check";
    case "index":
      return "Build";
    case "save":
      return "Save";
  }
}

export function demoIngestStatusCopy(state: DemoIngestState) {
  switch (state.step) {
    case "upload":
      return "Sending the local demo to the review service.";
    case "parser":
      return state.roundsIndexed > 0
        ? `${state.roundsIndexed}${state.roundsTotal != null ? ` / ${state.roundsTotal}` : ""} round${state.roundsIndexed === 1 ? "" : "s"} detected. Building the 2D review.`
        : "The upload was accepted. Detecting round structure.";
    case "validate":
      return "Checking the replay data before it enters the library.";
    case "index":
      return state.roundsTotal != null
        ? `Building ${state.roundsTotal} round${state.roundsTotal === 1 ? "" : "s"} into the match library.`
        : "Building rounds into the match library.";
    case "save":
      return "Match saved to the local library.";
  }
}

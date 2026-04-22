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
      return "Parse";
    case "validate":
      return "Validate";
    case "index":
      return "Index";
    case "save":
      return "Save";
  }
}

export function demoIngestStatusCopy(state: DemoIngestState) {
  switch (state.step) {
    case "upload":
      return "Sending the local demo to the parser.";
    case "parser":
      return state.roundsIndexed > 0
        ? `${state.roundsIndexed}${state.roundsTotal != null ? ` / ${state.roundsTotal}` : ""} parsed round${state.roundsIndexed === 1 ? "" : "s"} detected. Waiting for the replay artifact.`
        : "The parser accepted the upload. Detecting round structure.";
    case "validate":
      return "Validating the replay artifact before it enters the library.";
    case "index":
      return state.roundsTotal != null
        ? `Indexing ${state.roundsTotal} parsed round${state.roundsTotal === 1 ? "" : "s"} into the match library.`
        : "Indexing parsed rounds into the match library.";
    case "save":
      return "Match saved to the local library.";
  }
}

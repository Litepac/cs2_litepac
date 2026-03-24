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
      return "Sending demo to the local parser bridge.";
    case "parser":
      return "Waiting for the parser to emit canonical replay truth. The round rack is warming up before real rounds lock in.";
    case "validate":
      return "Validating the canonical replay artifact in the viewer.";
    case "index":
      return state.roundsTotal != null
        ? `Indexing ${state.roundsTotal} parsed round${state.roundsTotal === 1 ? "" : "s"} into the local match library.`
        : "Indexing parsed rounds into the local match library.";
    case "save":
      return "Saving the match locally so it survives reloads.";
  }
}

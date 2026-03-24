import { demoIngestStepLabel, demoIngestStatusCopy, demoIngestSteps, type DemoIngestState } from "../replay/ingestState";

type Props = {
  state: DemoIngestState;
};

export function IngestTracker({ state }: Props) {
  const placeholderCount = Math.max(24, state.roundsIndexed + 6);
  const placeholderRounds = Array.from({ length: placeholderCount }, (_, index) => index);

  return (
    <section className="ingest-tracker">
      <div className="ingest-tracker-header">
        <div>
          <div className="card-title">Demo Ingest</div>
          <strong>{state.mapName ? `${state.mapName} is being prepared` : "Preparing local match entry"}</strong>
        </div>
        <span>{state.fileName}</span>
      </div>

      <div className="ingest-step-row">
        {demoIngestSteps.map((step, index) => {
          const activeIndex = demoIngestSteps.indexOf(state.step);
          const status =
            index < activeIndex ? "ingest-step-complete" : index === activeIndex ? "ingest-step-active" : "";

          return (
            <div key={step} className={`ingest-step ${status}`}>
              <span>{demoIngestStepLabel(step)}</span>
            </div>
          );
        })}
      </div>

      <p className="ingest-status-copy">{demoIngestStatusCopy(state)}</p>

      <div className="ingest-rounds">
        <div className="ingest-rounds-header">
          <strong>Rounds</strong>
          <span>{state.roundsTotal != null ? `${state.roundsIndexed} / ${state.roundsTotal}` : "Waiting for canonical round count"}</span>
        </div>
        <div className="ingest-round-grid">
          {state.roundsTotal != null
            ? Array.from({ length: state.roundsTotal }, (_, index) => (
                <span
                  key={index}
                  className={`ingest-round-chip ${index < state.roundsIndexed ? "ingest-round-chip-active" : ""}`}
                >
                  {index + 1}
                </span>
              ))
            : placeholderRounds.map((index) =>
                index < state.roundsIndexed ? (
                  <span key={index} className="ingest-round-chip ingest-round-chip-active">
                    {index + 1}
                  </span>
                ) : (
                  <span key={index} className="ingest-round-chip ingest-round-chip-placeholder" />
                ),
              )}
        </div>
      </div>
    </section>
  );
}

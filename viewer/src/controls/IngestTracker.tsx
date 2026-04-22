import type { CSSProperties } from "react";
import { demoIngestStepLabel, demoIngestStatusCopy, demoIngestSteps, type DemoIngestState } from "../replay/ingestState";

type IngestIssue = {
  hint?: string;
  message: string;
  title: string;
};

type Props = {
  issue?: IngestIssue | null;
  state: DemoIngestState | null;
};

export function IngestTracker({ issue, state }: Props) {
  const failed = issue != null;
  const activeStep = state?.step ?? "parser";
  const activeIndex = demoIngestSteps.indexOf(activeStep);
  const roundsIndexed = state?.roundsIndexed ?? 0;
  const roundsTotal = state?.roundsTotal ?? null;
  const ready = !failed && state?.step === "save" && roundsTotal != null && roundsIndexed >= roundsTotal;
  const showProvisionalRoundNumbers = roundsTotal == null && !failed && state != null;
  const currentRoundIndex = roundsTotal != null && !ready ? Math.min(roundsIndexed, roundsTotal - 1) : null;
  const roundProgressPercent =
    roundsTotal != null && roundsTotal > 0 ? `${Math.min(roundsIndexed, roundsTotal) / roundsTotal * 100}%` : "0%";
  const placeholderCount = roundsTotal ?? Math.max(18, Math.min(24, roundsIndexed + 6));
  const placeholderRounds = Array.from({ length: placeholderCount }, (_, index) => index);
  const roundProgressLabel =
    roundsTotal != null
      ? ready
        ? `${roundsTotal} / ${roundsTotal} ready`
        : `${Math.min(roundsIndexed, roundsTotal)} / ${roundsTotal} locked - round ${Math.min(roundsIndexed + 1, roundsTotal)} active`
      : failed
        ? "Round count unavailable"
        : "Detecting round structure";
  const title = failed
    ? issue.title
    : state?.step === "save"
      ? `${state.mapName ?? "Match"} is ready`
      : state?.mapName
        ? `${state.mapName} is being prepared`
        : "Preparing local match entry";
  const statusCopy = failed ? issue.message : state ? demoIngestStatusCopy(state) : "Waiting for the parser to respond.";

  return (
    <section className={`ingest-tracker ${failed ? "ingest-tracker-failed" : ""} ${ready ? "ingest-tracker-ready" : ""}`}>
      <div className="ingest-tracker-header">
        <div>
          <div className="ingest-tracker-kicker">{failed ? "Demo ingest failed" : ready ? "Demo ready" : "Demo ingest"}</div>
          <strong>{title}</strong>
        </div>
        <span>{state?.fileName ?? "Local demo"}</span>
      </div>

      <div className="ingest-step-row">
        {demoIngestSteps.map((step, index) => {
          const status =
            index < activeIndex
              ? "ingest-step-complete"
              : index === activeIndex
                ? failed
                  ? "ingest-step-failed"
                  : "ingest-step-active"
                : "";

          return (
            <div key={step} className={`ingest-step ${status}`}>
              <span>{demoIngestStepLabel(step)}</span>
            </div>
          );
        })}
      </div>

      <div className="ingest-status-block">
        <p className="ingest-status-copy">{statusCopy}</p>
        {failed && issue.hint ? <p className="ingest-status-hint">{issue.hint}</p> : null}
      </div>

      <div className="ingest-rounds">
        <div className="ingest-rounds-header">
          <strong>Rounds</strong>
          <span>{roundProgressLabel}</span>
        </div>
        <div
          className={`ingest-round-grid ${roundsTotal != null ? "ingest-round-grid-known" : ""} ${
            roundsTotal == null && !failed ? "ingest-round-grid-scanning" : ""
          }`}
          style={{ "--ingest-round-progress": roundProgressPercent } as CSSProperties}
        >
          {placeholderRounds.map((index) => (
            <span
              key={index}
              aria-label={
                roundsTotal != null
                  ? `Round ${index + 1}${
                      index < roundsIndexed ? " locked" : index === currentRoundIndex ? " processing" : " waiting"
                    }`
                  : index < roundsIndexed
                    ? `Parsed round ${index + 1}`
                    : `Round ${index + 1} waiting for structure`
              }
              className={`ingest-round-chip ${
                index < roundsIndexed
                  ? "ingest-round-chip-active"
                  : roundsTotal != null && index === currentRoundIndex
                    ? "ingest-round-chip-current"
                    : roundsTotal == null && !failed
                      ? "ingest-round-chip-placeholder"
                      : roundsTotal != null
                        ? "ingest-round-chip-waiting"
                        : ""
              } ${showProvisionalRoundNumbers && index >= roundsIndexed ? "ingest-round-chip-provisional" : ""}`}
              title={
                roundsTotal != null
                  ? `Round ${index + 1}${
                      index < roundsIndexed ? " locked" : index === currentRoundIndex ? " processing" : " waiting"
                    }`
                  : index < roundsIndexed
                    ? `Parsed round ${index + 1}`
                    : `Round ${index + 1} waiting for structure`
              }
            >
              <span className="ingest-round-number">
                {roundsTotal != null || index < roundsIndexed || showProvisionalRoundNumbers ? index + 1 : ""}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

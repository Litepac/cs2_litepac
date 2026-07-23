import type { CSSProperties } from "react";
import { demoIngestStepLabel, demoIngestStatusCopy, demoIngestSteps, type DemoIngestState } from "../replay/ingestState";
import styles from "./IngestTracker.module.css";

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
  const statusCopy = failed ? issue.message : state ? demoIngestStatusCopy(state) : "Waiting for local demo processing.";

  return (
    <section className={[styles.tracker, failed ? styles.failed : "", ready ? styles.ready : ""].filter(Boolean).join(" ")}>
      <div className={styles.header}>
        <div>
          <div className={styles.kicker}>{failed ? "Demo upload failed" : ready ? "Demo ready" : "Preparing demo"}</div>
          <strong className={styles.title}>{title}</strong>
        </div>
        <span className={styles.fileName}>{state?.fileName ?? "Local demo"}</span>
      </div>

      <div className={styles.stepRow}>
        {demoIngestSteps.map((step, index) => {
          const status =
            index < activeIndex
              ? styles.stepComplete
              : index === activeIndex
                ? failed
                  ? styles.stepFailed
                  : styles.stepActive
                : "";

          return (
            <div key={step} className={[styles.step, status].filter(Boolean).join(" ")}>
              <span>{demoIngestStepLabel(step)}</span>
            </div>
          );
        })}
      </div>

      <div className={styles.statusBlock}>
        <p className={styles.statusCopy}>{statusCopy}</p>
        {failed && issue.hint ? <p className={styles.statusHint}>{issue.hint}</p> : null}
      </div>

      <div className={styles.rounds}>
        <div className={styles.roundsHeader}>
          <strong>Rounds</strong>
          <span>{roundProgressLabel}</span>
        </div>
        <div
          className={[
            styles.roundGrid,
            roundsTotal != null ? styles.roundGridKnown : "",
            roundsTotal == null && !failed ? styles.roundGridScanning : "",
          ].filter(Boolean).join(" ")}
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
                    ? `Processed round ${index + 1}`
                    : `Round ${index + 1} waiting for structure`
              }
              className={[styles.roundChip,
                index < roundsIndexed
                  ? styles.roundChipActive
                  : roundsTotal != null && index === currentRoundIndex
                    ? styles.roundChipCurrent
                    : roundsTotal == null && !failed
                      ? styles.roundChipPlaceholder
                      : roundsTotal != null
                        ? styles.roundChipWaiting
                        : ""
                ,
                showProvisionalRoundNumbers && index >= roundsIndexed ? styles.roundChipProvisional : "",
              ].filter(Boolean).join(" ")}
              title={
                roundsTotal != null
                  ? `Round ${index + 1}${
                      index < roundsIndexed ? " locked" : index === currentRoundIndex ? " processing" : " waiting"
                    }`
                  : index < roundsIndexed
                    ? `Processed round ${index + 1}`
                    : `Round ${index + 1} waiting for structure`
              }
            >
              <span className={styles.roundNumber}>
                {roundsTotal != null || index < roundsIndexed || showProvisionalRoundNumbers ? index + 1 : ""}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

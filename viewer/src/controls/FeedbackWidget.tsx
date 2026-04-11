import { useState, type FormEvent } from "react";

import { submitFeedback, trackUsageEvent } from "../replay/parserBridge";

type Props = {
  context: Record<string, unknown>;
};

type FeedbackStatus = "idle" | "sending" | "sent" | "error";

export function FeedbackWidget({ context }: Props) {
  const [message, setMessage] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || status === "sending") {
      return;
    }

    setStatus("sending");
    setError(null);
    trackUsageEvent("feedback_submit_started", {
      messageLength: trimmedMessage.length,
      ...context,
    });

    try {
      await submitFeedback(trimmedMessage, context);
      setMessage("");
      setStatus("sent");
      trackUsageEvent("feedback_submit_succeeded", {
        messageLength: trimmedMessage.length,
        ...context,
      });
    } catch (submissionError) {
      setStatus("error");
      const errorMessage = submissionError instanceof Error ? submissionError.message : String(submissionError);
      setError(errorMessage);
      trackUsageEvent("feedback_submit_failed", {
        error: errorMessage,
        messageLength: trimmedMessage.length,
        ...context,
      });
    }
  }

  function togglePanel() {
    const nextOpen = !panelOpen;
    setPanelOpen(nextOpen);

    if (nextOpen) {
      trackUsageEvent("feedback_opened", context);
    } else {
      setError(null);
      setStatus("idle");
    }
  }

  return (
    <div className={`feedback-widget ${panelOpen ? "feedback-widget-open" : ""}`}>
      {panelOpen ? (
        <form className="feedback-panel" onSubmit={handleSubmit}>
          <div className="feedback-panel-head">
            <div>
              <p className="eyebrow">Feedback</p>
              <h2>Send a note</h2>
            </div>
            <button className="feedback-close-button" onClick={togglePanel} type="button">
              Close
            </button>
          </div>

          <label className="feedback-field">
            <span>What feels wrong, missing, or good?</span>
            <textarea
              maxLength={4000}
              onChange={(event) => {
                setMessage(event.target.value);
                if (status !== "sending") {
                  setStatus("idle");
                  setError(null);
                }
              }}
              placeholder="Example: Position Player is useful, but clicking a ghost into live replay feels hard to track in round 8."
              rows={5}
              value={message}
            />
          </label>

          <div className="feedback-panel-foot">
            <p
              className={`feedback-status-copy ${
                status === "error"
                  ? "feedback-status-copy-error"
                  : status === "sent"
                    ? "feedback-status-copy-success"
                    : ""
              }`}
            >
              {status === "error"
                ? error || "Feedback failed to send."
                : status === "sent"
                  ? "Saved locally. Thanks."
                  : "Logged on this PC while the tunnel is running."}
            </p>
            <button
              className="feedback-submit-button"
              disabled={!message.trim() || status === "sending"}
              type="submit"
            >
              {status === "sending" ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      ) : null}

      <button className="feedback-launch-button" onClick={togglePanel} type="button">
        Feedback
      </button>
    </div>
  );
}

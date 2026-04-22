import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { submitFeedback, trackUsageEvent } from "../replay/parserBridge";

type Props = {
  context: Record<string, unknown>;
};

type FeedbackStatus = "idle" | "sending" | "sent" | "error";

export function FeedbackWidget({ context }: Props) {
  const titleId = useId();
  const launchButtonRef = useRef<HTMLButtonElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [message, setMessage] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (panelOpen) {
      textareaRef.current?.focus();
    }
  }, [panelOpen]);

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

  function openPanel() {
    setPanelOpen(true);
    trackUsageEvent("feedback_opened", context);
  }

  function closePanel() {
    setPanelOpen(false);
    setError(null);
    setStatus("idle");
    window.setTimeout(() => launchButtonRef.current?.focus(), 0);
  }

  function togglePanel() {
    if (panelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
    }
  }

  return (
    <div className={`feedback-widget ${panelOpen ? "feedback-widget-open" : ""}`}>
      {panelOpen ? (
        <form
          aria-labelledby={titleId}
          className="feedback-panel"
          onKeyDown={handlePanelKeyDown}
          onSubmit={handleSubmit}
          role="dialog"
        >
          <div className="feedback-panel-head">
            <div>
              <p className="eyebrow">Feedback</p>
              <h2 id={titleId}>Send a note</h2>
            </div>
            <button className="feedback-close-button" onClick={closePanel} type="button">
              Close
            </button>
          </div>

          <label className="feedback-field">
            <span>What feels wrong, missing, or good?</span>
            <textarea
              ref={textareaRef}
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

      <button
        ref={launchButtonRef}
        aria-expanded={panelOpen}
        className="feedback-launch-button"
        onClick={togglePanel}
        type="button"
      >
        Feedback
      </button>
    </div>
  );
}

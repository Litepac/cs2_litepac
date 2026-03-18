import { useEffect, useRef } from "react";

import type { Round } from "../replay/types";

type Props = {
  activeRoundIndex: number;
  rounds: Round[];
  onSelectRound: (index: number) => void;
};

export function RoundStrip({ activeRoundIndex, rounds, onSelectRound }: Props) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeButton = buttonRefs.current[activeRoundIndex];
    if (!activeButton) {
      return;
    }

    activeButton.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeRoundIndex]);

  return (
    <section className="round-strip">
      <div className="round-strip-header">
        <div className="round-strip-title">
          <div className="eyebrow">Rounds</div>
        </div>
        <div className="round-strip-tools">
          <span className="round-strip-status">R{rounds[activeRoundIndex]?.roundNumber ?? 0} / {rounds.length}</span>
          <div className="round-strip-buttons">
            <button
              className="round-nav-button"
              disabled={activeRoundIndex <= 0}
              onClick={() => onSelectRound(Math.max(0, activeRoundIndex - 1))}
            >
              Prev
            </button>
            <button
              className="round-nav-button"
              disabled={activeRoundIndex >= rounds.length - 1}
              onClick={() => onSelectRound(Math.min(rounds.length - 1, activeRoundIndex + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="round-pill-row" ref={rowRef}>
        {rounds.map((round, index) => (
          <button
            key={round.roundNumber}
            ref={(element) => {
              buttonRefs.current[index] = element;
            }}
            className={index === activeRoundIndex ? "round-pill round-pill-active" : "round-pill"}
            onClick={() => onSelectRound(index)}
          >
            <span>R{round.roundNumber}</span>
            <strong>{round.scoreAfter.ct}:{round.scoreAfter.t}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

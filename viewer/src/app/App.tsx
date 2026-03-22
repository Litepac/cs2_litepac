import { useState } from "react";

import { ReplayStage } from "../canvas/ReplayStage";
import { KillFeed } from "../controls/KillFeed";
import { RosterPanel } from "../controls/RosterPanel";
import { Sidebar } from "../controls/Sidebar";
import type { UtilityFocus } from "../replay/utilityFilter";
import { TimelinePanel } from "../timeline/TimelinePanel";
import { useFixtureCatalog } from "./useFixtureCatalog";
import { useReplayLoader } from "./useReplayLoader";
import { useReplayPlayback } from "./useReplayPlayback";
import { useTimelineMarkers } from "./useTimelineMarkers";

export function App() {
  const fixtures = useFixtureCatalog();
  const {
    error,
    onFileChange,
    onFixtureLoad,
    replay,
    roundIndex,
    selectedPlayerId,
    setRoundIndex,
    setSelectedPlayerId,
  } = useReplayLoader();
  const [utilityFocus, setUtilityFocus] = useState<UtilityFocus>("all");
  const [showFreezeTime, setShowFreezeTime] = useState(false);

  const round = replay?.rounds[roundIndex] ?? null;
  const playback = useReplayPlayback(replay, round, roundIndex, showFreezeTime);
  const timelineMarkers = useTimelineMarkers(replay, round, utilityFocus);

  return (
    <div className="sky-shell">
      <Sidebar
        error={error}
        fixtures={fixtures}
        replay={replay}
        onFileChange={onFileChange}
        onFixtureLoad={onFixtureLoad}
      />

      <main className="viewer-shell">
        {replay && round ? (
          <>
            <section className="map-workspace">
              <div className="map-stage-frame">
                <ReplayStage
                  key={`${replay.sourceDemo.fileName}:${round.roundNumber}`}
                  currentTick={playback.renderTick}
                  replay={replay}
                  round={round}
                  selectedPlayerId={selectedPlayerId}
                  utilityFocus={utilityFocus}
                  onSelectPlayer={setSelectedPlayerId}
                />
                <KillFeed currentTick={playback.renderTickRounded} replay={replay} round={round} />
                <aside className="right-shell right-shell-overlay">
                  <RosterPanel
                    replay={replay}
                    round={round}
                    currentTick={playback.renderTickRounded}
                    selectedPlayerId={selectedPlayerId}
                    onSelectPlayer={setSelectedPlayerId}
                  />
                </aside>
              </div>
            </section>

            <TimelinePanel
              activeRoundIndex={roundIndex}
              currentTick={playback.tick}
              replay={replay}
              markers={timelineMarkers}
              playing={playback.playing}
              roundClock={playback.roundClock}
              round={round}
              rounds={replay.rounds}
              showFreezeTime={showFreezeTime}
              speed={playback.speed}
              tick={playback.tick}
              tickRate={replay.match.tickRate}
              utilityFocus={utilityFocus}
              onSelectRound={setRoundIndex}
              onPlayToggle={playback.togglePlayback}
              onReset={playback.resetPlayback}
              onSpeedChange={playback.setSpeed}
              onShowFreezeTimeChange={setShowFreezeTime}
              onTickChange={playback.changeTick}
              onUtilityFocusChange={setUtilityFocus}
            />
          </>
        ) : (
          <section className="empty-state">
            <div className="eyebrow">Viewer</div>
            <h2>Canonical replay only</h2>
            <p>Load a validated `mastermind.replay.json` file to inspect rounds, positions, bomb flow, and utility timing.</p>
          </section>
        )}
      </main>
    </div>
  );
}

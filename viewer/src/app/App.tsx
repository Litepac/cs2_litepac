import { useState } from "react";

import { ReplayStage } from "../canvas/ReplayStage";
import { HomePage } from "../controls/HomePage";
import { KillFeed } from "../controls/KillFeed";
import { MatchesPage } from "../controls/MatchesPage";
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
    activeReplayId,
    closeReplay,
    demoIngestState,
    error,
    libraryHydrated,
    libraryEntries,
    loadingSource,
    onDemoFileChange,
    onFixtureLoad,
    openReplay,
    parserBridgeAvailable,
    replay,
    roundIndex,
    selectedPlayerId,
    setRoundIndex,
    setSelectedPlayerId,
  } = useReplayLoader();
  const [utilityFocus, setUtilityFocus] = useState<UtilityFocus>("all");
  const [showFreezeTime, setShowFreezeTime] = useState(false);
  const [shellPage, setShellPage] = useState<"home" | "matches">("home");

  const round = replay?.rounds[roundIndex] ?? null;
  const playback = useReplayPlayback(replay, round, roundIndex, showFreezeTime);
  const timelineMarkers = useTimelineMarkers(replay, round, utilityFocus);

  async function handleDemoFileChange(event: Parameters<typeof onDemoFileChange>[0]) {
    await onDemoFileChange(event);
    setShellPage("matches");
  }

  function handleOpenMatch(id: string) {
    openReplay(id);
    setShellPage("matches");
  }

  function handleCloseReplay() {
    closeReplay();
    setShellPage("matches");
  }

  return (
    <div className="sky-shell">
      <Sidebar
        activeReplayId={activeReplayId}
        matches={libraryEntries}
        shellPage={shellPage}
        onCloseReplay={handleCloseReplay}
        onOpenMatch={handleOpenMatch}
        onSelectShellPage={setShellPage}
        error={error}
        loadingSource={loadingSource}
        replay={replay}
      />

      <main className={`viewer-shell ${replay ? "viewer-shell-replay" : `viewer-shell-${shellPage}`}`}>
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
          shellPage === "home" ? (
            <HomePage onOpenMatches={() => setShellPage("matches")} parserBridgeAvailable={parserBridgeAvailable} />
          ) : (
            <MatchesPage
              demoIngestState={demoIngestState}
              fixtures={fixtures}
              libraryHydrated={libraryHydrated}
              matches={libraryEntries}
              loadingSource={loadingSource}
              parserBridgeAvailable={parserBridgeAvailable}
              onDemoFileChange={handleDemoFileChange}
              onFixtureLoad={onFixtureLoad}
              onOpenMatch={handleOpenMatch}
            />
          )
        )}
      </main>
    </div>
  );
}

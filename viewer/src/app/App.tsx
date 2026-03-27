import { useState } from "react";

import { ReplayStage } from "../canvas/ReplayStage";
import { HomePage } from "../controls/HomePage";
import { KillFeed } from "../controls/KillFeed";
import { MatchesPage } from "../controls/MatchesPage";
import { RosterPanel } from "../controls/RosterPanel";
import { ShellTopNav } from "../controls/ShellTopNav";
import { Sidebar } from "../controls/Sidebar";
import { StatsPage } from "../controls/StatsPage";
import type { UtilityFocus } from "../replay/utilityFilter";
import { TimelinePanel } from "../timeline/TimelinePanel";
import { useFixtureCatalog } from "./useFixtureCatalog";
import { useReplayLoader } from "./useReplayLoader";
import { useReplayPlayback } from "./useReplayPlayback";
import { useTimelineMarkers } from "./useTimelineMarkers";

export function App() {
  const fixtures = useFixtureCatalog();
  const {
    closeReplay,
    demoIngestState,
    deleteReplay,
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
  const [shellPage, setShellPage] = useState<"home" | "matches" | "stats">("home");
  const [statsMatchId, setStatsMatchId] = useState<string | null>(null);

  const round = replay?.rounds[roundIndex] ?? null;
  const playback = useReplayPlayback(replay, round, roundIndex, showFreezeTime);
  const timelineMarkers = useTimelineMarkers(replay, round, utilityFocus);
  const statsEntry = statsMatchId ? libraryEntries.find((entry) => entry.id === statsMatchId) ?? null : null;

  async function handleDemoFileChange(event: Parameters<typeof onDemoFileChange>[0]) {
    await onDemoFileChange(event);
    setShellPage("matches");
  }

  function handleOpenMatch(id: string) {
    openReplay(id);
    setShellPage("matches");
  }

  function handleOpenStats(id: string) {
    setStatsMatchId(id);
    setShellPage("stats");
  }

  const showSidebar = replay != null;

  return (
    <div className={`sky-shell ${!replay ? `sky-shell-${shellPage}` : "sky-shell-replay"}`}>
      {showSidebar ? (
        <Sidebar
          onSelectShellPage={(page) => {
            closeReplay();
            setShellPage(page);
          }}
        />
      ) : null}

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
        ) : shellPage === "home" ? (
            <section className="home-surface">
              <ShellTopNav
                actionLabel={libraryEntries.length > 0 ? "Open Matches" : "Start Local Review"}
                localMatchCount={libraryEntries.length}
                onAction={() => setShellPage("matches")}
                onOpenHome={() => setShellPage("home")}
                onOpenMatches={() => setShellPage("matches")}
                parserBridgeAvailable={parserBridgeAvailable}
                shellPage={shellPage}
              />
              <HomePage
                latestMatch={libraryEntries[0] ?? null}
                localMatchCount={libraryEntries.length}
                onOpenMatches={() => setShellPage("matches")}
                parserBridgeAvailable={parserBridgeAvailable}
              />
            </section>
          ) : shellPage === "matches" ? (
            <section className="matches-surface">
              <ShellTopNav
                localMatchCount={libraryEntries.length}
                onOpenHome={() => setShellPage("home")}
                onOpenMatches={() => setShellPage("matches")}
                parserBridgeAvailable={parserBridgeAvailable}
                shellPage={shellPage}
              />
              <MatchesPage
                demoIngestState={demoIngestState}
                error={error}
                fixtures={fixtures}
                libraryHydrated={libraryHydrated}
                matches={libraryEntries}
                loadingSource={loadingSource}
                parserBridgeAvailable={parserBridgeAvailable}
                onDemoFileChange={handleDemoFileChange}
                onDeleteMatch={deleteReplay}
                onFixtureLoad={onFixtureLoad}
                onOpenMatch={handleOpenMatch}
                onOpenStats={handleOpenStats}
              />
            </section>
          ) : (
            <section className="matches-surface stats-surface">
              <ShellTopNav
                localMatchCount={libraryEntries.length}
                onOpenHome={() => setShellPage("home")}
                onOpenMatches={() => setShellPage("matches")}
                parserBridgeAvailable={parserBridgeAvailable}
                shellPage={shellPage}
              />
              {statsEntry ? (
                <StatsPage
                  entry={statsEntry}
                  onBackToMatches={() => setShellPage("matches")}
                  onOpenReplay={(id) => {
                    openReplay(id);
                    setShellPage("stats");
                  }}
                />
              ) : (
                <section className="matches-page stats-page">
                  <div className="match-library-empty">This match is no longer available in your local library.</div>
                </section>
              )}
            </section>
          )
        }
      </main>
    </div>
  );
}

import type { ChangeEvent, RefObject } from "react";

import { HomePage } from "../controls/HomePage";
import { MatchesPage } from "../controls/MatchesPage";
import { ProMatchesPage } from "../controls/ProMatchesPage";
import { ShellTopNav } from "../controls/ShellTopNav";
import { StatsPage, StatsPageUnavailable } from "../controls/StatsPage";
import type { LoaderIssue } from "./useReplayLoader";
import type { FixtureIndex } from "../replay/fixtures";
import type { DemoIngestState } from "../replay/ingestState";
import { hasLoadedReplay, type MatchCompetition, type MatchLibraryEntry } from "../replay/matchLibrary";
import type { ParserBridgeHealth } from "../replay/parserBridge";

type FeedbackContext = Record<string, unknown>;

type HomeShellPageProps = {
  feedbackContext: FeedbackContext;
  onOpenHome: () => void;
  onOpenMatches: () => void;
  onOpenProMatches: () => void;
};

type MatchesShellPageProps = {
  demoIngestState: DemoIngestState | null;
  error: LoaderIssue | null;
  feedbackContext: FeedbackContext;
  fixtures: FixtureIndex["files"];
  libraryEntries: MatchLibraryEntry[];
  libraryHydrated: boolean;
  loadingSource: "demo" | "fixture" | "replay" | null;
  matchesUploadInputRef: RefObject<HTMLInputElement | null>;
  parserBridgeAvailable: boolean;
  parserBridgeHealth: ParserBridgeHealth;
  onDemoFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onDeleteMatch: (id: string) => void | Promise<void>;
  onFixtureLoad: (fileName: string) => void | Promise<void>;
  onOpenHome: () => void;
  onOpenMatch: (id: string) => void;
  onOpenMatches: () => void;
  onOpenProMatches: () => void;
  onOpenStats: (id: string) => void;
};

type ProMatchesShellPageProps = {
  feedbackContext: FeedbackContext;
  libraryEntries: MatchLibraryEntry[];
  libraryHydrated: boolean;
  loadingSource: "demo" | "fixture" | "replay" | null;
  matchesUploadInputRef: RefObject<HTMLInputElement | null>;
  parserBridgeAvailable: boolean;
  onDemoFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onOpenHome: () => void;
  onOpenMatch: (id: string) => void;
  onOpenMatches: () => void;
  onOpenProMatches: () => void;
  onOpenStats: (id: string) => void;
  onUpdateCompetition: (id: string, competition: MatchCompetition | null) => Promise<void>;
};

type StatsShellPageProps = {
  feedbackContext: FeedbackContext;
  libraryEntries: MatchLibraryEntry[];
  onOpenHome: () => void;
  onOpenMatches: () => void;
  onOpenProMatches: () => void;
  onOpenReplay: (id: string) => void;
  onBackToMatches: () => void;
  parserBridgeAvailable: boolean;
  statsParent: "matches" | "proMatches";
  statsEntry: MatchLibraryEntry | null;
};

export function HomeShellPage({ feedbackContext, onOpenHome, onOpenMatches, onOpenProMatches }: HomeShellPageProps) {
  return (
    <section className="home-surface home-surface-landing">
      <ShellTopNav
        actionLabel="Open Matches"
        feedbackContext={feedbackContext}
        localMatchCount={0}
        onAction={onOpenMatches}
        onOpenHome={onOpenHome}
        onOpenMatches={onOpenMatches}
        onOpenProMatches={onOpenProMatches}
        parserBridgeAvailable={false}
        shellPage="home"
      />
      <HomePage onOpenMatches={onOpenMatches} />
    </section>
  );
}

export function MatchesShellPage({
  demoIngestState,
  error,
  feedbackContext,
  fixtures,
  libraryEntries,
  libraryHydrated,
  loadingSource,
  matchesUploadInputRef,
  parserBridgeAvailable,
  parserBridgeHealth,
  onDemoFileChange,
  onDeleteMatch,
  onFixtureLoad,
  onOpenHome,
  onOpenMatch,
  onOpenMatches,
  onOpenProMatches,
  onOpenStats,
}: MatchesShellPageProps) {
  return (
    <section className="matches-surface home-surface-landing">
      <ShellTopNav
        actionDisabled={loadingSource != null || !parserBridgeAvailable}
        actionLabel={parserBridgeAvailable ? "Upload Demo" : "Upload Paused"}
        feedbackContext={feedbackContext}
        localMatchCount={libraryEntries.length}
        onAction={() => matchesUploadInputRef.current?.click()}
        onOpenHome={onOpenHome}
        onOpenMatches={onOpenMatches}
        onOpenProMatches={onOpenProMatches}
        parserBridgeAvailable={parserBridgeAvailable}
        shellPage="matches"
      />
      <MatchesPage
        demoIngestState={demoIngestState}
        error={error}
        fixtures={fixtures}
        libraryHydrated={libraryHydrated}
        matches={libraryEntries}
        loadingSource={loadingSource}
        parserBridgeAvailable={parserBridgeAvailable}
        parserBridgeHealth={parserBridgeHealth}
        uploadInputRef={matchesUploadInputRef}
        onDemoFileChange={onDemoFileChange}
        onDeleteMatch={onDeleteMatch}
        onFixtureLoad={onFixtureLoad}
        onOpenMatch={onOpenMatch}
        onOpenStats={onOpenStats}
      />
    </section>
  );
}

export function ProMatchesShellPage({
  feedbackContext,
  libraryEntries,
  libraryHydrated,
  loadingSource,
  matchesUploadInputRef,
  parserBridgeAvailable,
  onDemoFileChange,
  onOpenHome,
  onOpenMatch,
  onOpenMatches,
  onOpenProMatches,
  onOpenStats,
  onUpdateCompetition,
}: ProMatchesShellPageProps) {
  return (
    <section className="matches-surface home-surface-landing">
      <ShellTopNav
        actionDisabled={loadingSource != null || !parserBridgeAvailable}
        actionLabel={parserBridgeAvailable ? "Upload Pro Demo" : "Upload Paused"}
        feedbackContext={feedbackContext}
        localMatchCount={libraryEntries.length}
        onAction={() => matchesUploadInputRef.current?.click()}
        onOpenHome={onOpenHome}
        onOpenMatches={onOpenMatches}
        onOpenProMatches={onOpenProMatches}
        parserBridgeAvailable={parserBridgeAvailable}
        shellPage="proMatches"
      />
      <ProMatchesPage
        libraryHydrated={libraryHydrated}
        loadingSource={loadingSource}
        matches={libraryEntries}
        parserBridgeAvailable={parserBridgeAvailable}
        uploadInputRef={matchesUploadInputRef}
        onDemoFileChange={onDemoFileChange}
        onOpenMatch={onOpenMatch}
        onOpenStats={onOpenStats}
        onUpdateCompetition={onUpdateCompetition}
      />
    </section>
  );
}

export function StatsShellPage({
  feedbackContext,
  libraryEntries,
  onBackToMatches,
  onOpenHome,
  onOpenMatches,
  onOpenProMatches,
  onOpenReplay,
  parserBridgeAvailable,
  statsParent,
  statsEntry,
}: StatsShellPageProps) {
  return (
    <section className="matches-surface stats-surface">
      <ShellTopNav
        feedbackContext={feedbackContext}
        localMatchCount={libraryEntries.length}
        onOpenHome={onOpenHome}
        onOpenMatches={onOpenMatches}
        onOpenProMatches={onOpenProMatches}
        parserBridgeAvailable={parserBridgeAvailable}
        shellPage="stats"
        statsParent={statsParent}
      />
      {statsEntry && hasLoadedReplay(statsEntry) ? (
        <StatsPage
          entry={statsEntry}
          onBackToMatches={onBackToMatches}
          onOpenReplay={onOpenReplay}
        />
      ) : (
        <StatsPageUnavailable />
      )}
    </section>
  );
}

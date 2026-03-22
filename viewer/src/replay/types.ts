export type Replay = {
  format: "mastermind.replay";
  schemaVersion: string;
  generatedAt: string;
  generator: {
    name: string;
    version: string;
  };
  sourceDemo: {
    fileName: string;
    sha256: string;
    tickRate: number;
    tickCount: number;
    demoProtocol: number | null;
    notes?: string[];
  };
  match: {
    matchId: string | null;
    tickRate: number;
    totalRounds: number;
    bombTimeSeconds: number | null;
    gameMode: string | null;
  };
  map: {
    mapId: string;
    displayName: string;
    radarImageKey: string;
    coordinateSystem: {
      worldXMin: number;
      worldXMax: number;
      worldYMin: number;
      worldYMax: number;
      rotateDegrees: number;
    };
  };
  teams: Array<{
    teamId: string;
    displayName: string;
    clanName: string | null;
  }>;
  players: Array<{
    playerId: string;
    displayName: string;
    steamId: string | null;
    teamId: string;
  }>;
  rounds: Round[];
};

export type Round = {
  roundNumber: number;
  startTick: number;
  freezeEndTick: number | null;
  endTick: number;
  officialEndTick: number | null;
  scoreBefore: { t: number; ct: number };
  scoreAfter: { t: number; ct: number };
  winnerSide: "T" | "CT" | null;
  endReason: string | null;
  playerStreams: PlayerStream[];
  blindEvents: BlindEvent[];
  fireEvents: FireEvent[];
  hurtEvents: HurtEvent[];
  killEvents: KillEvent[];
  bombEvents: BombEvent[];
  utilityEntities: UtilityEntity[];
};

export type PlayerStream = {
  playerId: string;
  side: "T" | "CT" | null;
  sampleOriginTick: number;
  sampleIntervalTicks: 1;
  x: Array<number | null>;
  y: Array<number | null>;
  z: Array<number | null>;
  yaw: Array<number | null>;
  alive: boolean[];
  hasBomb: boolean[];
  health: Array<number | null>;
  armor: Array<number | null>;
  hasHelmet: boolean[];
  money: Array<number | null>;
  activeWeapon: Array<string | null>;
  activeWeaponClass: Array<"pistol" | "smg" | "heavy" | "rifle" | "sniper" | "knife" | "utility" | "equipment" | "unknown" | null>;
  mainWeapon: Array<string | null>;
  flashbangs: Array<number | null>;
  smokes: Array<number | null>;
  heGrenades: Array<number | null>;
  fireGrenades: Array<number | null>;
  decoys: Array<number | null>;
};

export type KillEvent = {
  tick: number;
  killerPlayerId: string | null;
  victimPlayerId: string;
  assisterPlayerId: string | null;
  weaponName: string;
  isHeadshot: boolean;
  penetratedObjects: number | null;
  throughSmoke: boolean | null;
  killerX: number | null;
  killerY: number | null;
  killerZ: number | null;
  victimX: number | null;
  victimY: number | null;
  victimZ: number | null;
};

export type FireEvent = {
  tick: number;
  playerId: string | null;
  weaponName: string;
  x: number | null;
  y: number | null;
  z: number | null;
};

export type BlindEvent = {
  tick: number;
  playerId: string;
  attackerPlayerId: string | null;
  durationTicks: number;
  endTick: number;
};

export type HurtEvent = {
  tick: number;
  attackerPlayerId: string | null;
  victimPlayerId: string | null;
  weaponName: string;
  healthDamageTaken: number;
  armorDamageTaken: number;
  attackerX: number | null;
  attackerY: number | null;
  attackerZ: number | null;
  victimX: number | null;
  victimY: number | null;
  victimZ: number | null;
};

export type BombEvent = {
  tick: number;
  type: string;
  playerId: string | null;
  site: "A" | "B" | null;
  x: number | null;
  y: number | null;
  z: number | null;
};

export type UtilityEntity = {
  utilityId: string;
  kind: "smoke" | "flashbang" | "hegrenade" | "molotov" | "incendiary" | "decoy";
  throwerPlayerId: string | null;
  startTick: number;
  detonateTick: number | null;
  endTick: number | null;
  trajectory: {
    sampleOriginTick: number;
    sampleIntervalTicks: number;
    x: Array<number | null>;
    y: Array<number | null>;
    z: Array<number | null>;
  };
  phaseEvents: Array<{
    tick: number;
    type: string;
    x: number | null;
    y: number | null;
    z: number | null;
    durationTicks?: number | null;
  }>;
};

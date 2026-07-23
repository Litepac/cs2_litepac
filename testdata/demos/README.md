# Owned demo extraction fixture

`ci-owned-bot.dem` is DemoRead's clean-checkout `.dem` to canonical replay
regression fixture.

## Provenance

- Recorded by the project owner on 2026-07-23.
- Recorded on a local, LAN-only, headless CS2 dedicated server running Mirage.
- Recorded by SourceTV with zero human clients and two Valve bots.
- CS2 reported version `1.41.7.2/14172`, protocol/build `10847`.
- The committed file contains no player SteamIDs in canonical parser output.
- The recording is project-generated test data. Valve retains all rights in
  Counter-Strike 2 and its game data.

The original client-side recording was deliberately not committed because it
contained the owner's Steam identity. It remains useful only as a private
manual regression for the current-build nil bomb-property updates documented
in `parser/third_party/demoinfocs/README.demoread.md`.

## Frozen identity

- File: `ci-owned-bot.dem`
- Size: `452923` bytes
- SHA-256:
  `e1eb40e70f5e2a947b20824935b6c199500579556a8b3900b2f377e48ce78cfa`
- Expected extraction: Mirage, 64 tick, 1313 source ticks, one round, two
  players, two teams, one kill, one bomb-drop event, no utility, and no empty
  player streams.

## Recording workflow

The committed configuration and RCON helper live in `tools/fixtures`.

1. Copy `demoread-ci-dedicated.cfg` into the CS2 `game/csgo/cfg` directory.
2. Copy `demoread-ci-gamemode-server.cfg` to
   `game/csgo/cfg/gamemode_competitive_server.cfg`.
3. Launch the dedicated server with `-hltv`, `+sv_hibernate_when_empty 0`,
   `+tv_enable 1`, competitive mode, and `+map de_mirage`.
4. Confirm RCON reports zero humans, two gameplay bots, SourceTV, and
   `not hibernating`.
5. Start `tv_record`, wait three seconds, end warmup, and restart the match.
6. Wait twelve seconds for the live round, run `bot_kill t`, wait for
   round-end, then run `tv_stoprecord`.
7. Parse the result and update this file only when the new artifact and
   assertions have been reviewed intentionally.

The fixture is expected to change when CS2 changes its demo protocol. Treat a
hash or summary change as parser-review work, not as an automatic golden-file
refresh.

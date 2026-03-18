# Mastermind

Trustworthy CS2 2D replay system with a parser-first architecture.

## Current Workflow

### Parse local demo fixtures

```powershell
cd parser
go run .\cmd\fixtureparse
```

This reads `.dem` files from `testdata/demos/` and writes canonical replay artifacts to `testdata/replays/`.

### Run parser validation

```powershell
cd parser
go test ./...
```

If local replay fixtures are present, tests validate them against:

- `schema/mastermind.replay.schema.json`
- semantic replay invariants
- `testdata/goldens/replay-manifest.json`

### Stage local replay fixtures for the viewer

```powershell
cd parser
go run .\cmd\fixturestage
```

This copies local replay outputs from `testdata/replays/` into `assets/fixtures/` and writes `assets/fixtures/index.json`.

### Build the viewer

```powershell
cd viewer
npm.cmd run build
```

### Run the viewer locally

```powershell
cd viewer
npm.cmd run dev
```

You can then either:

- load a generated `mastermind.replay.json` file manually through the UI, or
- click a staged fixture from the left panel if `go run .\cmd\fixturestage` has been run

## Visual Review Loop

1. Put `.dem` files in `testdata/demos/`
2. Run `go run .\cmd\fixtureparse`
3. Run `go run .\cmd\fixturestage`
4. Start the viewer with `npm.cmd run dev`
5. Load a fixture replay and compare it against the source demo

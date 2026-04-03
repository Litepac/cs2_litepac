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
npm.cmd run dev -- --host 127.0.0.1 --port 4173
```

The viewer dev server starts the Go parser API from `parser/cmd/mastermind-api` and serves the app on `http://127.0.0.1:4173/`.

- `GET http://127.0.0.1:4318/api/health` confirms which parser process is serving the local ingest API
- `POST /api/parse-demo` accepts multipart `.dem` upload and returns canonical `mastermind.replay.json`

The viewer can then offer `.dem` upload from the page while still keeping raw demo parsing outside the browser runtime.

If Windows blocks the Go parser binary, use the fallback Node bridge instead:

```powershell
cd parser
go build -o fixtureparse.exe .\cmd\fixtureparse
cd ..
node tools\local-parser-bridge.mjs
```

`/api/health` should then report `"bridge":"node-fixtureparse"`.

You can then either:

- load a generated `mastermind.replay.json` file manually through the UI, or
- upload a `.dem` directly in the UI if one of the local parser API paths above is running, or
- click a staged fixture from the left panel if `go run .\cmd\fixturestage` has been run

## Visual Review Loop

1. Put `.dem` files in `testdata/demos/`
2. Run `go run .\cmd\fixtureparse`
3. Run `go run .\cmd\fixturestage`
4. Start the viewer with `npm.cmd run dev -- --host 127.0.0.1 --port 4173`
5. Load a fixture replay and compare it against the source demo

# Performance Measurement Runbook

This project only flags regressions from measured signals.
If measurements are unavailable, report: `No measurements found`.

## Parser Benchmarks

Benchmarks live in `parser/internal/validate/performance_bench_test.go`.
They run against real canonical replay fixtures from `testdata/replays`.

If `testdata/replays` is missing locally, benchmarks skip by design.

Run:

```powershell
Set-Location parser
go test ./internal/validate -run ^$ -bench BenchmarkReplay -benchmem -count=10 > .bench-new.txt
```

Compare to a previous baseline:

```powershell
go install golang.org/x/perf/cmd/benchstat@latest
benchstat .bench-old.txt .bench-new.txt
```

## Parser CPU / Memory Profiles And Trace

Capture benchmark profiles:

```powershell
Set-Location parser
go test ./internal/validate -run ^$ -bench BenchmarkReplay -cpuprofile cpu.out -memprofile mem.out -trace trace.out
```

Inspect:

```powershell
go tool pprof -http=:0 cpu.out
go tool pprof -http=:0 mem.out
go tool trace trace.out
```

## Full `.dem` Parse Measurement

When local demos are available, parse them to canonical replay first, then benchmark and trace the parser path with those outputs.

Example parse command:

```powershell
Set-Location parser
go run .\cmd\mastermind --demo <path-to-demo.dem> --out ..\testdata\replays\<fixture-name>.json
```

Then rerun the benchmark/profile commands above.

## Viewer Trace Capture

Use a fixed replay fixture and a repeatable interaction script:
- open replay
- play for a fixed duration
- scrub over the same round window
- toggle utility focus in a fixed sequence

Capture in Chrome:
1. Open DevTools -> `Performance`.
2. Click Record.
3. Execute the fixed interaction script.
4. Stop recording and export trace JSON.

Store traces under `docs/perf/traces/` and compare against previous captures for frame-time and long-task drift.

## Baseline Discipline

- Keep at least one committed benchmark output and one trace capture per meaningful baseline.
- Use the same fixture and interaction sequence for comparisons.
- Call a regression only when the measured change is repeatable.

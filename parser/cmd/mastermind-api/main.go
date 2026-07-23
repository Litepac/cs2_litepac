package main

import (
	"flag"
	"fmt"
	"os"

	"mastermind/parser/internal/server"
)

func main() {
	fs := flag.NewFlagSet("mastermind-api", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)

	var listenAddr string
	var schemaPath string
	var assetsRoot string
	var tempDir string
	var maxUploadBytes int64
	var maxConcurrentParses int
	var allowedOrigin string
	fs.StringVar(&listenAddr, "listen", "127.0.0.1:4318", "HTTP listen address")
	fs.StringVar(&schemaPath, "schema", "", "Path to schema/mastermind.replay.schema.json")
	fs.StringVar(&assetsRoot, "assets-root", "", "Path to public/maps")
	fs.StringVar(&tempDir, "temp-dir", "", "Directory for temporary uploaded demos and replay artifacts")
	fs.Int64Var(&maxUploadBytes, "max-upload-bytes", 0, "Maximum demo upload size in bytes; defaults to 512 MiB")
	fs.IntVar(&maxConcurrentParses, "max-concurrent-parses", 0, "Maximum concurrent demo parses; defaults to 1")
	fs.StringVar(&allowedOrigin, "allowed-origin", "", "Exact Access-Control-Allow-Origin value; omitted by default for same-origin proxy use")

	if err := fs.Parse(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	if err := server.Serve(server.Options{
		ListenAddr:          listenAddr,
		SchemaPath:          schemaPath,
		AssetsRoot:          assetsRoot,
		TempDir:             tempDir,
		MaxUploadBytes:      maxUploadBytes,
		MaxConcurrentParses: maxConcurrentParses,
		AllowedOrigin:       allowedOrigin,
	}); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

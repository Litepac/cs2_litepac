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
	fs.StringVar(&listenAddr, "listen", "127.0.0.1:4318", "HTTP listen address")
	fs.StringVar(&schemaPath, "schema", "", "Path to schema/mastermind.replay.schema.json")
	fs.StringVar(&assetsRoot, "assets-root", "", "Path to assets/maps")
	fs.StringVar(&tempDir, "temp-dir", "", "Directory for temporary uploaded demos and replay artifacts")

	if err := fs.Parse(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	if err := server.Serve(server.Options{
		ListenAddr: listenAddr,
		SchemaPath: schemaPath,
		AssetsRoot: assetsRoot,
		TempDir:    tempDir,
	}); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

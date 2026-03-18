package cli

import (
	"flag"
	"fmt"
	"io"

	"mastermind/parser/internal/demo"
)

type Flags struct {
	DemoPath   string
	OutputPath string
	SchemaPath string
	AssetsRoot string
}

func ParseFlags(args []string, stderr io.Writer) (Flags, error) {
	fs := flag.NewFlagSet("mastermind", flag.ContinueOnError)
	fs.SetOutput(stderr)

	var flags Flags
	fs.StringVar(&flags.DemoPath, "demo", "", "Path to the source .dem file")
	fs.StringVar(&flags.OutputPath, "out", "", "Path to write mastermind.replay.json")
	fs.StringVar(&flags.SchemaPath, "schema", "", "Path to schema/mastermind.replay.schema.json")
	fs.StringVar(&flags.AssetsRoot, "assets-root", "", "Path to assets/maps")

	if err := fs.Parse(args); err != nil {
		return Flags{}, err
	}

	if flags.DemoPath == "" {
		return Flags{}, fmt.Errorf("missing required -demo argument")
	}

	return flags, nil
}

func Run(flags Flags) error {
	return demo.Parse(demo.Options{
		DemoPath:   flags.DemoPath,
		OutputPath: flags.OutputPath,
		SchemaPath: flags.SchemaPath,
		AssetsRoot: flags.AssetsRoot,
	})
}

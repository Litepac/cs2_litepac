package main

import (
	"fmt"
	"os"

	"mastermind/parser/internal/cli"
)

func main() {
	flags, err := cli.ParseFlags(os.Args[1:], os.Stderr)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	if err := cli.Run(flags); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

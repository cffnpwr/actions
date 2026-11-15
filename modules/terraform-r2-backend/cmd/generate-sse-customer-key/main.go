package main

import (
	"errors"
	"flag"
	"fmt"
	"os"

	"github.com/cffnpwr/actions/modules/terraform-r2-backend/internal/ssecustomerkey"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	fs := flag.NewFlagSet("generate-sse-customer-key", flag.ContinueOnError)
	output := fs.String("output", "", "path to write the age-encrypted SSE-C key to")
	recipientsFile := fs.String(
		"recipients-file",
		"",
		"path to the ConfigMap manifest that holds the age recipients",
	)
	recipientsKey := fs.String(
		"recipients-key",
		"",
		"key in data of the ConfigMap whose value lists the age recipients, one per line",
	)
	fs.Usage = func() {
		fmt.Fprintln(
			fs.Output(),
			"usage: generate-sse-customer-key --output <path> --recipients-file <path> --recipients-key <key>",
		)
		fs.PrintDefaults()
	}
	if err := fs.Parse(os.Args[1:]); err != nil {
		return err
	}
	if *output == "" || *recipientsFile == "" || *recipientsKey == "" || fs.NArg() > 0 {
		fs.Usage()
		return errors.New(
			"--output, --recipients-file and --recipients-key are required and no positional arguments are accepted",
		)
	}

	if err := ssecustomerkey.Generate(*output, *recipientsFile, *recipientsKey); err != nil {
		return err
	}
	fmt.Fprintf(os.Stdout, "wrote %s\n", *output)
	return nil
}

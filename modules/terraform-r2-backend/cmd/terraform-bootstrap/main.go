package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"syscall"

	"github.com/cffnpwr/actions/modules/terraform-r2-backend/internal/r2"
	"github.com/cffnpwr/actions/modules/terraform-r2-backend/internal/ssecustomerkey"
)

type options struct {
	cloudflareAccountID string
	root                string
	sseCustomerKeyFile  string
	terraformArgs       []string
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	opts, err := parseOptions(os.Args[1:])
	if err != nil {
		return err
	}

	apiToken := os.Getenv("CLOUDFLARE_API_TOKEN")
	if apiToken == "" {
		return errors.New("CLOUDFLARE_API_TOKEN is not set")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// NOTE: S3 backendの認証情報はCLOUDFLARE_API_TOKENのトークンから作る
	credentials, err := r2.NewCredentials(ctx, opts.cloudflareAccountID, apiToken)
	if err != nil {
		return err
	}
	if err = setEnv(map[string]string{
		"AWS_ACCESS_KEY_ID":     credentials.AccessKeyID,
		"AWS_SECRET_ACCESS_KEY": credentials.SecretAccessKey,
	}); err != nil {
		return err
	}

	if os.Getenv("AWS_SSE_CUSTOMER_KEY") == "" {
		key, decryptErr := decryptSSECustomerKey(opts.sseCustomerKeyFile)
		if decryptErr != nil {
			return decryptErr
		}
		if err = setEnv(map[string]string{"AWS_SSE_CUSTOMER_KEY": key}); err != nil {
			return err
		}
	}

	terraformPath, err := exec.LookPath("terraform")
	if err != nil {
		return fmt.Errorf("find terraform: %v", err)
	}
	argv := append([]string{"terraform", "-chdir=" + opts.root}, opts.terraformArgs...)
	// NOTE: 標準入出力・シグナルをterraformが直接扱うためプロセスをterraformに置き換える
	if err = syscall.Exec(terraformPath, argv, os.Environ()); err != nil {
		return fmt.Errorf("exec %s: %v", terraformPath, err)
	}
	return nil
}

func parseOptions(args []string) (options, error) {
	fs := flag.NewFlagSet("terraform-bootstrap", flag.ContinueOnError)
	accountID := fs.String(
		"cloudflare-account-id",
		"",
		"ID of the Cloudflare account that owns the token in CLOUDFLARE_API_TOKEN",
	)
	root := fs.String("root", "", "path to the Terraform root directory")
	keyFile := fs.String(
		"sse-customer-key-file",
		"",
		"path to the age-encrypted SSE-C key, decrypted when AWS_SSE_CUSTOMER_KEY is not set",
	)
	fs.Usage = func() {
		fmt.Fprintln(
			fs.Output(),
			"usage: terraform-bootstrap --cloudflare-account-id <id> --root <path> --sse-customer-key-file <path> [--] [terraform arguments...]",
		)
		fs.PrintDefaults()
	}

	// NOTE: flagは最初の位置引数か--で解析を止めるため以降の引数をterraformの引数として渡す
	if err := fs.Parse(args); err != nil {
		return options{}, err
	}
	if *accountID == "" || *root == "" || *keyFile == "" {
		fs.Usage()
		return options{}, errors.New(
			"--cloudflare-account-id, --root and --sse-customer-key-file are required",
		)
	}
	return options{
		cloudflareAccountID: *accountID,
		root:                *root,
		sseCustomerKeyFile:  *keyFile,
		terraformArgs:       fs.Args(),
	}, nil
}

func decryptSSECustomerKey(keyPath string) (string, error) {
	if _, err := os.Stat(keyPath); err != nil {
		return "", fmt.Errorf(
			"AWS_SSE_CUSTOMER_KEY is not set and %s is not readable: %v",
			keyPath,
			err,
		)
	}
	identityPath := os.Getenv("AGE_IDENTITY_FILE")
	if identityPath == "" {
		return "", errors.New("AWS_SSE_CUSTOMER_KEY and AGE_IDENTITY_FILE are not set")
	}

	return ssecustomerkey.Decrypt(keyPath, identityPath)
}

func setEnv(values map[string]string) error {
	for name, value := range values {
		if err := os.Setenv(name, value); err != nil {
			return fmt.Errorf("set %s: %v", name, err)
		}
	}
	return nil
}

package main

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/google/go-github/v93/github"

	"github.com/cffnpwr/actions/modules/github-app/internal/appconfig"
	"github.com/cffnpwr/actions/modules/github-app/internal/gh"
	"github.com/cffnpwr/actions/modules/github-app/internal/githubapp"
)

// 秘密鍵だけを含むファイルのため所有者だけが読み書きできる権限にする
const privateKeyFileMode = 0o600

var errDestinationExists = errors.New("credential of the GitHub App already exists")

// Client IDと秘密鍵の書き込み先を確認
func checkDestination(ctx context.Context, client *github.Client, opts options) error {
	switch d := opts.definition.Destination.(type) {
	case appconfig.EnvironmentDestination:
		for _, repo := range opts.repos {
			if err := checkEnvironmentDestination(ctx, client, opts, repo, d); err != nil {
				return err
			}
		}
		return nil
	case appconfig.PrivateKeyFileDestination:
		return checkPrivateKeyFile(opts, d)
	}
	panic(fmt.Sprintf("unreachable destination: %T", opts.definition.Destination))
}

func checkEnvironmentDestination(
	ctx context.Context,
	client *github.Client,
	opts options,
	repo gh.Repository,
	d appconfig.EnvironmentDestination,
) error {
	_, _, err := client.Repositories.GetEnvironment(ctx, repo.Owner, repo.Name, d.Environment)
	if err != nil {
		if gh.IsNotFound(err) {
			return fmt.Errorf("environment %q does not exist in %s", d.Environment, repo)
		}
		return fmt.Errorf("get environment %q in %s: %v", d.Environment, repo, err)
	}

	if opts.isForced {
		return nil
	}
	variableName := clientIDVariableName(d)
	_, _, err = client.Actions.GetEnvVariable(
		ctx,
		repo.Owner,
		repo.Name,
		d.Environment,
		variableName,
	)
	switch {
	case err == nil:
		return fmt.Errorf(
			"%w: variable %s in environment %q of %s; --force overwrites it",
			errDestinationExists,
			variableName,
			d.Environment,
			repo,
		)
	case gh.IsNotFound(err):
		return nil
	}
	return fmt.Errorf(
		"get variable %s in environment %q of %s: %v",
		variableName,
		d.Environment,
		repo,
		err,
	)
}

func checkPrivateKeyFile(opts options, d appconfig.PrivateKeyFileDestination) error {
	if opts.isForced {
		return nil
	}
	path := d.Path
	_, err := os.Stat(path)
	switch {
	case err == nil:
		return fmt.Errorf("%w: %s; --force overwrites it", errDestinationExists, path)
	case errors.Is(err, os.ErrNotExist):
		return nil
	}
	return fmt.Errorf("check %s: %v", path, err)
}

func writeCredential(
	ctx context.Context,
	client *github.Client,
	opts options,
	credential githubapp.Credential,
) error {
	switch d := opts.definition.Destination.(type) {
	case appconfig.EnvironmentDestination:
		for _, repo := range opts.repos {
			if err := writeEnvironment(ctx, client, repo, d, credential); err != nil {
				return err
			}
		}
		return nil
	case appconfig.PrivateKeyFileDestination:
		return writePrivateKeyFile(d.Path, credential.PrivateKeyPEM)
	}
	panic(fmt.Sprintf("unreachable destination: %T", opts.definition.Destination))
}

func writeEnvironment(
	ctx context.Context,
	client *github.Client,
	repo gh.Repository,
	d appconfig.EnvironmentDestination,
	credential githubapp.Credential,
) error {
	if err := gh.SetEnvironmentVariable(
		ctx,
		client,
		repo,
		d.Environment,
		clientIDVariableName(d),
		credential.ClientID,
	); err != nil {
		return err
	}
	return gh.SetEnvironmentSecret(
		ctx,
		client,
		repo,
		d.Environment,
		d.CredentialPrefix+"_APP_PRIVATE_KEY",
		credential.PrivateKeyPEM,
	)
}

func writePrivateKeyFile(path string, privateKeyPEM []byte) error {
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, privateKeyFileMode)
	if err != nil {
		return fmt.Errorf("create %s: %v", path, err)
	}
	// NOTE: OpenFileは既存のファイルの権限を変えないため、--forceで上書きする場合も権限を設定
	err = file.Chmod(privateKeyFileMode)
	if err == nil {
		_, err = file.Write(privateKeyPEM)
	}
	if err = errors.Join(err, file.Close()); err != nil {
		return fmt.Errorf("write %s: %v", path, err)
	}
	fmt.Fprintf(os.Stdout, "wrote the private key to %s\n", path)
	return nil
}

func clientIDVariableName(d appconfig.EnvironmentDestination) string {
	return d.CredentialPrefix + "_APP_CLIENT_ID"
}

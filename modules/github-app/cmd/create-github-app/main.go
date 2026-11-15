package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"

	"github.com/cli/browser"
	"github.com/google/go-github/v93/github"

	"github.com/cffnpwr/actions/modules/github-app/internal/gh"
	"github.com/cffnpwr/actions/modules/github-app/internal/githubapp"
	"github.com/cffnpwr/actions/modules/github-app/internal/manifest"
)

// app-manifestsのconversionsの応答から使う項目
type convertedApp struct {
	ID       int64
	Slug     string
	ClientID string
	PEM      string
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

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	client, err := gh.NewAPIClient()
	if err != nil {
		return err
	}
	if err = checkDestination(ctx, client, opts); err != nil {
		return err
	}

	app, err := registerApp(ctx, client, opts)
	if err != nil {
		return err
	}
	openPage(
		"install the GitHub App on "+opts.repos.String(),
		"https://github.com/apps/"+app.Slug+"/installations/new",
	)
	credential := githubapp.Credential{
		AppID:         app.ID,
		ClientID:      app.ClientID,
		PrivateKeyPEM: []byte(app.PEM),
	}
	for _, repo := range opts.repos {
		if err = githubapp.WaitInstallation(ctx, credential, repo.Owner, repo.Name); err != nil {
			return fmt.Errorf("%s: %w", repo, err)
		}
	}
	if err = writeCredential(ctx, client, opts, credential); err != nil {
		return err
	}
	fmt.Fprintf(os.Stdout, "slug: %s\nApp ID: %d\nClient ID: %s\n", app.Slug, app.ID, app.ClientID)
	return nil
}

// manifestからGitHub Appを登録する
func registerApp(ctx context.Context, client *github.Client, opts options) (convertedApp, error) {
	newAppURL, err := resolveNewAppURL(ctx, client, opts.repos[0].Owner)
	if err != nil {
		return convertedApp{}, err
	}

	definition := opts.definition
	flow := manifest.Flow{
		NewAppURL: newAppURL,
		Manifest: manifest.Manifest{
			Name:               definition.Name,
			URL:                definition.URL,
			HookAttributes:     manifest.HookAttributes{URL: definition.URL, Active: false},
			Public:             false,
			DefaultPermissions: definition.Permissions,
			DefaultEvents:      []string{},
		},
		OnListening: func(pageURL string) { openPage("register the GitHub App", pageURL) },
		ListenPort:  opts.listenPort,
	}
	code, err := flow.Run(ctx)
	if err != nil {
		return convertedApp{}, err
	}

	return convertManifest(ctx, client, code)
}

func resolveNewAppURL(ctx context.Context, client *github.Client, owner string) (string, error) {
	ownerAccount, _, err := client.Users.Get(ctx, owner)
	if err != nil {
		return "", fmt.Errorf("get account %s: %v", owner, err)
	}

	if ownerAccount.GetType() == "Organization" {
		return "https://github.com/organizations/" + owner + "/settings/apps/new", nil
	}
	return "https://github.com/settings/apps/new", nil
}

func convertManifest(
	ctx context.Context,
	client *github.Client,
	code string,
) (convertedApp, error) {
	app, _, err := client.Apps.CompleteAppManifest(ctx, code)
	if err != nil {
		return convertedApp{}, fmt.Errorf("create the GitHub App from the manifest: %v", err)
	}
	return convertedApp{
		ID:       app.GetID(),
		Slug:     app.GetSlug(),
		ClientID: app.GetClientID(),
		PEM:      app.GetPEM(),
	}, nil
}

func openPage(action, url string) {
	fmt.Fprintf(os.Stderr, "Open the following URL in a browser to %s:\n%s\n", action, url)

	// NOTE: 非GUI環境ではブラウザを開けないため、失敗してもエラーにせず案内だけを表示する
	browser.Stdout = io.Discard
	browser.Stderr = io.Discard
	if err := browser.OpenURL(url); err != nil {
		fmt.Fprintln(os.Stderr, "Could not open a browser automatically.")
	}
}

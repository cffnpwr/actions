package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/cffnpwr/actions/modules/github-app/internal/appconfig"
	"github.com/cffnpwr/actions/modules/github-app/internal/gh"
)

const maxPort = 65535

type options struct {
	definition appconfig.Definition
	// GitHub Appをインストールするリポジトリ。すべて同じownerである必要がある
	repos    repositoryList
	isForced bool
	// manifest flowで待ち受けるポート
	listenPort int
}

type repositoryList []gh.Repository

func (l *repositoryList) String() string {
	names := make([]string, 0, len(*l))
	for _, repo := range *l {
		names = append(names, repo.String())
	}
	return strings.Join(names, ",")
}

func (l *repositoryList) Set(value string) error {
	owner, name, isFound := strings.Cut(value, "/")
	if !isFound || owner == "" || name == "" || strings.Contains(name, "/") {
		return fmt.Errorf("repository must be <owner>/<name>, got %q", value)
	}
	*l = append(*l, gh.Repository{Owner: owner, Name: name})
	return nil
}

func parseOptions(args []string) (options, error) {
	fs := flag.NewFlagSet("create-github-app", flag.ContinueOnError)
	var repos repositoryList
	fs.Var(&repos, "repo", "repository <owner>/<name> to install the GitHub App on; repeatable")
	configPath := fs.String("config", "", "path to the definition file of the GitHub App")
	isForced := fs.Bool("force", false, "overwrite the existing credential")
	listenPort := fs.Int(
		"listen-port",
		0,
		"port on 127.0.0.1 to receive the redirect of the manifest flow; the OS chooses a free port if omitted",
	)
	fs.Usage = func() { printUsage(fs) }

	if err := fs.Parse(args); err != nil {
		return options{}, err
	}
	if fs.NArg() > 0 || *configPath == "" {
		fs.Usage()
		return options{}, errors.New(
			"--config is required and no positional arguments are accepted",
		)
	}
	if err := validateRepos(repos); err != nil {
		fs.Usage()
		return options{}, err
	}
	if err := validateListenPort(fs, *listenPort); err != nil {
		return options{}, err
	}

	definition, err := loadDefinition(*configPath)
	if err != nil {
		return options{}, err
	}
	return options{
		definition: definition,
		repos:      repos,
		isForced:   *isForced,
		listenPort: *listenPort,
	}, nil
}

func printUsage(fs *flag.FlagSet) {
	fmt.Fprintln(
		fs.Output(),
		"usage: create-github-app [flags] --config <path> --repo <owner>/<name> [--repo <owner>/<name>...]",
	)
	fs.PrintDefaults()
}

func validateRepos(repos repositoryList) error {
	if len(repos) == 0 {
		return errors.New("--repo is required")
	}
	// NOTE: GitHub Appはownerごとにインストールするため、1回の実行で扱うownerは1つ
	for _, repo := range repos[1:] {
		if repo.Owner != repos[0].Owner {
			return fmt.Errorf(
				"all --repo must have the same owner, got %s and %s",
				repos[0].Owner,
				repo.Owner,
			)
		}
	}
	return nil
}

// NOTE: 0は省略した場合と同じくOSが空いているポートを選ぶ動作になるため、1以上のポートだけを受け付ける
func validateListenPort(fs *flag.FlagSet, port int) error {
	isSet := false
	fs.Visit(func(f *flag.Flag) {
		if f.Name == "listen-port" {
			isSet = true
		}
	})
	if isSet && (port < 1 || port > maxPort) {
		return fmt.Errorf("--listen-port must be between 1 and %d", maxPort)
	}
	return nil
}

func loadDefinition(configPath string) (appconfig.Definition, error) {
	content, err := os.ReadFile(configPath)
	if err != nil {
		return appconfig.Definition{}, fmt.Errorf("read %s: %v", configPath, err)
	}
	definition, err := appconfig.Parse(content)
	if err != nil {
		return appconfig.Definition{}, fmt.Errorf("%s: %w", configPath, err)
	}
	return definition, nil
}

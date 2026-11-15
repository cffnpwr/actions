package appconfig

import (
	"bytes"
	_ "embed"
	"errors"
	"fmt"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"go.yaml.in/yaml/v4"
)

const (
	// NOTE: 検証のエラーメッセージに作業ディレクトリのパスを含めないため、file URLではなくURNで識別
	schemaResourceName = "urn:cffnpwr:create-github-app:schema"

	destinationTypeEnvironment    = "environment"
	destinationTypePrivateKeyFile = "privateKeyFile"
)

//go:embed schema.json
var schemaJSON []byte

var (
	ErrInvalid = errors.New("invalid GitHub App definition")

	definitionSchema = compileSchema()
)

type Definition struct {
	Name string
	// GitHub Appのホームページ
	URL string
	// GitHub Appのmanifestのdefault_permissions
	Permissions map[string]string
	Destination Destination
}

//sumtype:decl
type Destination interface {
	isDestination()
}

type EnvironmentDestination struct {
	Environment string
	// environmentに登録するvariable・secretの名前の接頭辞
	CredentialPrefix string
}

type PrivateKeyFileDestination struct {
	// 作業ディレクトリを起点としたファイルのパス
	Path string
}

type rawDefinition struct {
	Name        string            `yaml:"name"`
	URL         string            `yaml:"url"`
	Permissions map[string]string `yaml:"permissions"`
	Destination rawDestination    `yaml:"destination"`
}

type rawDestination struct {
	Type             string `yaml:"type"`
	Environment      string `yaml:"environment"`
	CredentialPrefix string `yaml:"credentialPrefix"`
	Path             string `yaml:"path"`
}

func (EnvironmentDestination) isDestination() {}

func (PrivateKeyFileDestination) isDestination() {}

func Parse(content []byte) (Definition, error) {
	var instance any
	if err := yaml.Load(content, &instance); err != nil {
		return Definition{}, fmt.Errorf("%w: decode: %v", ErrInvalid, err)
	}
	if err := definitionSchema.Validate(instance); err != nil {
		return Definition{}, fmt.Errorf("%w: %v", ErrInvalid, err)
	}

	var raw rawDefinition
	if err := yaml.Load(content, &raw); err != nil {
		return Definition{}, fmt.Errorf("%w: decode: %v", ErrInvalid, err)
	}
	return Definition{
		Name:        raw.Name,
		URL:         raw.URL,
		Permissions: raw.Permissions,
		Destination: raw.Destination.toDestination(),
	}, nil
}

func (d rawDestination) toDestination() Destination {
	switch d.Type {
	case destinationTypeEnvironment:
		return EnvironmentDestination{
			Environment:      d.Environment,
			CredentialPrefix: d.CredentialPrefix,
		}
	case destinationTypePrivateKeyFile:
		return PrivateKeyFileDestination{Path: d.Path}
	}
	panic(fmt.Sprintf("unreachable destination type validated by the schema: %q", d.Type))
}

func compileSchema() *jsonschema.Schema {
	document, err := jsonschema.UnmarshalJSON(bytes.NewReader(schemaJSON))
	if err != nil {
		panic(fmt.Sprintf("decode the embedded %s: %v", schemaResourceName, err))
	}
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	if err = compiler.AddResource(schemaResourceName, document); err != nil {
		panic(fmt.Sprintf("add the embedded %s: %v", schemaResourceName, err))
	}
	return compiler.MustCompile(schemaResourceName)
}

{
  description = "Shared GitHub Actions workflows for cffnpwr";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      perSystem =
        {
          system,
          ...
        }:
        let
          pkgs = import inputs.nixpkgs {
            inherit system;
            overlays = [ inputs.bun2nix.overlays.default ];
          };
        in
        {
          # Formatter
          formatter = pkgs.treefmt;

          packages.version-consistency-checker = pkgs.callPackage ./modules/version-consistency-checker { };

          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              # Common tools
              git
              treefmt

              # Github Actions linters
              actionlint
              ghalint
              zizmor

              # YAML linters and formatters
              yamlfmt

              # Nix linters and formatters
              nixd
              nixfmt

              # for TypeScript modules
              bun
              bun2nix
            ];

            shellHook = ''
              # Only exec into user shell for interactive sessions
              # Skip for non-interactive commands (like VSCode env detection)
              if [ -t 0 ] && [ -z "$__NIX_SHELL_EXEC" ]; then
                export __NIX_SHELL_EXEC=1

                # Detect user's login shell (works on both macOS and Linux)
                if command -v dscl >/dev/null 2>&1; then
                  # macOS
                  USER_SHELL=$(dscl . -read ~/ UserShell | sed 's/UserShell: //')
                elif command -v getent >/dev/null 2>&1; then
                  # Linux
                  USER_SHELL=$(getent passwd $USER | cut -d: -f7)
                else
                  # Fallback: read /etc/passwd directly
                  USER_SHELL=$(grep "^$USER:" /etc/passwd | cut -d: -f7)
                fi

                exec ''${USER_SHELL:-$SHELL}
              fi
            '';
          };
        };
    };
}

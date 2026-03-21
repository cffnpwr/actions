import { None, Some } from "@cffnpwr/result-ts";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import * as resolveBinModule from "../utils/resolveBin.ts";

import { nixProviderFactory } from "./nix.ts";

// Helper to create a fake spawnSync result
const spawnResult = (
  exitCode: number,
  stdout: string,
  stderr = "",
): ReturnType<typeof Bun.spawnSync> => {
  return {
    exitCode,
    stdout: Buffer.from(stdout),
    stderr: Buffer.from(stderr),
  } as unknown as ReturnType<typeof Bun.spawnSync>;
};

describe("nixProviderFactory", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("sourceName", () => {
    it("[positive] is 'nix'", () => {
      expect(nixProviderFactory.sourceName).toBe("nix");
    });
  });

  describe("getOptions", () => {
    it("[positive] returns --flake-dir (optional, default '.') and --nix-bin (optional)", () => {
      const options = nixProviderFactory.getOptions();
      const names = options.map((o) => o.name);
      expect(names).toContain("--flake-dir");
      expect(names).toContain("--nix-bin");

      const flakeDir = options.find((o) => o.name === "--flake-dir");
      expect(flakeDir?.required).toBe(false);
      expect((flakeDir as { default?: unknown; }).default).toBe(".");

      const nixBin = options.find((o) => o.name === "--nix-bin");
      expect(nixBin?.required).toBe(false);
    });
  });

  describe("create", () => {
    it("[positive] returns Ok when --nix-bin is explicitly provided", () => {
      const result = nixProviderFactory.create({
        "flake-dir": ".",
        "nix-bin": "/nix/bin/nix",
      });
      expect(result.isOk()).toBe(true);
    });

    it("[positive] returns Ok when nix is found in PATH", () => {
      spyOn(resolveBinModule, "resolveBin").mockReturnValue(Some("/usr/bin/nix"));
      const result = nixProviderFactory.create({ "flake-dir": "." });
      expect(result.isOk()).toBe(true);
    });

    it("[negative] returns Err when --nix-bin is not provided and nix is not found in PATH", () => {
      spyOn(resolveBinModule, "resolveBin").mockReturnValue(None());
      const result = nixProviderFactory.create({ "flake-dir": "." });
      expect(result.isErr()).toBe(true);
    });

    it("[negative] treats empty string --nix-bin as not provided and falls back to PATH resolution", () => {
      const resolveSpy = spyOn(resolveBinModule, "resolveBin").mockReturnValue(None());
      const result = nixProviderFactory.create({
        "flake-dir": ".",
        "nix-bin": "",
      });
      expect(result.isErr()).toBe(true);
      expect(resolveSpy).toHaveBeenCalledWith("nix");
    });
  });

  describe("fetchToolVersions", () => {
    it("[positive] calls nix eval with the flake-dir and returns Ok with parsed tool versions", async () => {
      const packagesJson = JSON.stringify([
        { name: "nodejs", version: "20.0.0" },
        { name: "python3", version: "3.12.0" },
      ]);
      const spawnSpy = spyOn(Bun, "spawnSync")
        .mockReturnValueOnce(spawnResult(0, "x86_64-linux"))
        .mockReturnValueOnce(spawnResult(0, packagesJson));

      const provider = nixProviderFactory
        .create({ "flake-dir": "/my/project", "nix-bin": "/nix/bin/nix" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({ nodejs: "20.0.0", python3: "3.12.0" });

      // Verify flake-dir is reflected in the nix eval command
      const secondCall = spawnSpy.mock.calls[1];
      expect(secondCall).toBeDefined();
      const cmd = secondCall?.[0] as string[];
      expect(cmd.some((arg) => arg.includes("/my/project"))).toBe(true);
    });

    it("[positive] uses '.' as flake-dir when not specified", async () => {
      const packagesJson = JSON.stringify([{ name: "nodejs", version: "20.0.0" }]);
      const spawnSpy = spyOn(Bun, "spawnSync")
        .mockReturnValueOnce(spawnResult(0, "x86_64-linux"))
        .mockReturnValueOnce(spawnResult(0, packagesJson));

      spyOn(resolveBinModule, "resolveBin").mockReturnValue(Some("/nix/bin/nix"));
      const provider = nixProviderFactory.create({}).unwrap();
      await provider.fetchToolVersions();

      // The flake reference should start with ".#" when no flake-dir is given
      const secondCall = spawnSpy.mock.calls[1];
      const cmd = secondCall?.[0] as string[];
      expect(cmd.some((arg) => arg.startsWith(".#"))).toBe(true);
    });

    it("[positive] skips packages with an empty version string", async () => {
      const packagesJson = JSON.stringify([
        { name: "nodejs", version: "20.0.0" },
        { name: "no-version-pkg", version: "" },
      ]);
      spyOn(Bun, "spawnSync")
        .mockReturnValueOnce(spawnResult(0, "x86_64-linux"))
        .mockReturnValueOnce(spawnResult(0, packagesJson));

      const provider = nixProviderFactory
        .create({ "flake-dir": ".", "nix-bin": "/nix/bin/nix" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({ nodejs: "20.0.0" });
    });

    it("[negative] returns Err when getting current system fails", async () => {
      spyOn(Bun, "spawnSync").mockReturnValueOnce(
        spawnResult(1, "", "nix: command failed"),
      );

      const provider = nixProviderFactory
        .create({ "flake-dir": ".", "nix-bin": "/nix/bin/nix" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isErr()).toBe(true);
    });

    it("[negative] returns Err when nix eval for packages fails (non-zero exit code)", async () => {
      spyOn(Bun, "spawnSync")
        .mockReturnValueOnce(spawnResult(0, "x86_64-linux"))
        .mockReturnValueOnce(spawnResult(1, "", "nix eval failed"));

      const provider = nixProviderFactory
        .create({ "flake-dir": ".", "nix-bin": "/nix/bin/nix" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isErr()).toBe(true);
    });

    it("[negative] returns Err when nix eval output is invalid JSON", async () => {
      spyOn(Bun, "spawnSync")
        .mockReturnValueOnce(spawnResult(0, "x86_64-linux"))
        .mockReturnValueOnce(spawnResult(0, "not-json"));

      const provider = nixProviderFactory
        .create({ "flake-dir": ".", "nix-bin": "/nix/bin/nix" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isErr()).toBe(true);
    });

    it("[negative] returns Err when nix eval output is valid JSON but not an array", async () => {
      spyOn(Bun, "spawnSync")
        .mockReturnValueOnce(spawnResult(0, "x86_64-linux"))
        .mockReturnValueOnce(spawnResult(0, JSON.stringify({ name: "nodejs", version: "20.0.0" })));

      const provider = nixProviderFactory
        .create({ "flake-dir": ".", "nix-bin": "/nix/bin/nix" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isErr()).toBe(true);
    });
  });
});

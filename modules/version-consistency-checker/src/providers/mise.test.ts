import { None, Some } from "@cffnpwr/result-ts";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import * as resolveBinModule from "../utils/resolveBin.ts";

import { miseProviderFactory } from "./mise.ts";

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

describe("miseProviderFactory", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("sourceName", () => {
    it("[positive] is 'mise'", () => {
      expect(miseProviderFactory.sourceName).toBe("mise");
    });
  });

  describe("getOptions", () => {
    it("[positive] returns --project-dir (optional, default '.') and --mise-bin (optional)", () => {
      const options = miseProviderFactory.getOptions();
      const names = options.map((o) => o.name);
      expect(names).toContain("--project-dir");
      expect(names).toContain("--mise-bin");

      const projectDir = options.find((o) => o.name === "--project-dir");
      expect(projectDir?.required).toBe(false);
      expect((projectDir as { default?: unknown; }).default).toBe(".");

      const miseBin = options.find((o) => o.name === "--mise-bin");
      expect(miseBin?.required).toBe(false);
    });
  });

  describe("create", () => {
    it("[positive] returns Ok when --mise-bin is explicitly provided", () => {
      const result = miseProviderFactory.create({
        "project-dir": ".",
        "mise-bin": "/usr/bin/mise",
      });
      expect(result.isOk()).toBe(true);
    });

    it("[positive] returns Ok when mise is found in PATH", () => {
      spyOn(resolveBinModule, "resolveBin").mockReturnValue(Some("/usr/bin/mise"));
      const result = miseProviderFactory.create({ "project-dir": "." });
      expect(result.isOk()).toBe(true);
    });

    it("[negative] returns Err when --mise-bin is not provided and mise is not found in PATH", () => {
      spyOn(resolveBinModule, "resolveBin").mockReturnValue(None());
      const result = miseProviderFactory.create({ "project-dir": "." });
      expect(result.isErr()).toBe(true);
    });

    it("[negative] treats empty string --mise-bin as not provided and falls back to PATH resolution", () => {
      const resolveSpy = spyOn(resolveBinModule, "resolveBin").mockReturnValue(None());
      const result = miseProviderFactory.create({
        "project-dir": ".",
        "mise-bin": "",
      });
      expect(result.isErr()).toBe(true);
      expect(resolveSpy).toHaveBeenCalledWith("mise");
    });
  });

  describe("fetchToolVersions", () => {
    it("[positive] returns Ok with active tool versions from mise list --json output", async () => {
      const miseOutput = JSON.stringify({
        node: [
          {
            version: "20.0.0",
            install_path: "/home/user/.local/share/mise/node/20.0.0",
            installed: true,
            active: true,
          },
        ],
        python: [
          {
            version: "3.12.0",
            install_path: "/home/user/.local/share/mise/python/3.12.0",
            installed: true,
            active: true,
          },
        ],
      });
      const spawnSpy = spyOn(Bun, "spawnSync").mockReturnValue(
        spawnResult(0, miseOutput),
      );

      const provider = miseProviderFactory
        .create({ "project-dir": "/my/project", "mise-bin": "/usr/bin/mise" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({ node: "20.0.0", python: "3.12.0" });

      // Verify project-dir is passed as cwd
      const call = spawnSpy.mock.calls[0];
      expect(call).toBeDefined();
      const opts = call?.[1] as { cwd?: string; };
      expect(opts.cwd).toBe("/my/project");
    });

    it("[positive] only includes the active tool version when multiple versions exist for a tool", async () => {
      const miseOutput = JSON.stringify({
        node: [
          {
            version: "18.0.0",
            install_path: "/home/user/.local/share/mise/node/18.0.0",
            installed: true,
            active: false,
          },
          {
            version: "20.0.0",
            install_path: "/home/user/.local/share/mise/node/20.0.0",
            installed: true,
            active: true,
          },
        ],
      });
      spyOn(Bun, "spawnSync").mockReturnValue(spawnResult(0, miseOutput));

      const provider = miseProviderFactory
        .create({ "project-dir": ".", "mise-bin": "/usr/bin/mise" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({ node: "20.0.0" });
    });

    it("[positive] uses the first active entry when multiple active entries exist for a tool", async () => {
      const miseOutput = JSON.stringify({
        node: [
          {
            version: "20.0.0",
            install_path: "/home/user/.local/share/mise/node/20.0.0",
            installed: true,
            active: true,
          },
          {
            version: "22.0.0",
            install_path: "/home/user/.local/share/mise/node/22.0.0",
            installed: true,
            active: true,
          },
        ],
      });
      spyOn(Bun, "spawnSync").mockReturnValue(spawnResult(0, miseOutput));

      const provider = miseProviderFactory
        .create({ "project-dir": ".", "mise-bin": "/usr/bin/mise" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isOk()).toBe(true);
      // First active entry wins
      expect(result.unwrap()).toEqual({ node: "20.0.0" });
    });

    it("[positive] skips tools whose entry list is empty", async () => {
      const miseOutput = JSON.stringify({
        node: [],
        python: [
          {
            version: "3.12.0",
            install_path: "/home/user/.local/share/mise/python/3.12.0",
            installed: true,
            active: true,
          },
        ],
      });
      spyOn(Bun, "spawnSync").mockReturnValue(spawnResult(0, miseOutput));

      const provider = miseProviderFactory
        .create({ "project-dir": ".", "mise-bin": "/usr/bin/mise" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({ python: "3.12.0" });
    });

    it("[positive] skips tools that have no active version", async () => {
      const miseOutput = JSON.stringify({
        node: [
          {
            version: "18.0.0",
            install_path: "/home/user/.local/share/mise/node/18.0.0",
            installed: false,
            active: false,
          },
        ],
        python: [
          {
            version: "3.12.0",
            install_path: "/home/user/.local/share/mise/python/3.12.0",
            installed: true,
            active: true,
          },
        ],
      });
      spyOn(Bun, "spawnSync").mockReturnValue(spawnResult(0, miseOutput));

      const provider = miseProviderFactory
        .create({ "project-dir": ".", "mise-bin": "/usr/bin/mise" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({ python: "3.12.0" });
    });

    it("[negative] returns Err when mise list fails (non-zero exit code)", async () => {
      spyOn(Bun, "spawnSync").mockReturnValue(spawnResult(1, "", "mise: command failed"));

      const provider = miseProviderFactory
        .create({ "project-dir": ".", "mise-bin": "/usr/bin/mise" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isErr()).toBe(true);
    });

    it("[negative] returns Err when mise output is invalid JSON", async () => {
      spyOn(Bun, "spawnSync").mockReturnValue(spawnResult(0, "not-json"));

      const provider = miseProviderFactory
        .create({ "project-dir": ".", "mise-bin": "/usr/bin/mise" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isErr()).toBe(true);
    });

    it("[negative] returns Err when mise output is valid JSON but not an object", async () => {
      spyOn(Bun, "spawnSync").mockReturnValue(
        spawnResult(0, JSON.stringify([{ node: "20.0.0" }])),
      );

      const provider = miseProviderFactory
        .create({ "project-dir": ".", "mise-bin": "/usr/bin/mise" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isErr()).toBe(true);
    });

    it("[positive] returns Ok with empty record when mise returns no tools", async () => {
      spyOn(Bun, "spawnSync").mockReturnValue(spawnResult(0, "{}"));

      const provider = miseProviderFactory
        .create({ "project-dir": ".", "mise-bin": "/usr/bin/mise" })
        .unwrap();
      const result = await provider.fetchToolVersions();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({});
    });
  });
});

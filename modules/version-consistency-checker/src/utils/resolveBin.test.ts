import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { resolveBin } from "./resolveBin.ts";

describe("resolveBin", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("when the binary exists in PATH", () => {
    it("[positive] returns Some with the resolved path", () => {
      const spy = spyOn(Bun, "which").mockReturnValue("/usr/bin/sh");
      const result = resolveBin("sh");
      expect(result.isSome()).toBe(true);
      expect(result.unwrap()).toBe("/usr/bin/sh");
      expect(spy).toHaveBeenCalledWith("sh");
    });

    it("[positive] returns Some containing an absolute path", () => {
      spyOn(Bun, "which").mockReturnValue("/usr/local/bin/node");
      const path = resolveBin("node").unwrap();
      expect(path).toStartWith("/");
    });
  });

  describe("when the binary does not exist in PATH", () => {
    it("[negative] returns None when Bun.which returns null", () => {
      spyOn(Bun, "which").mockReturnValue(null);
      const result = resolveBin("nonexistent");
      expect(result.isNone()).toBe(true);
    });

    it("[negative] returns None for an empty string without calling Bun.which", () => {
      const spy = spyOn(Bun, "which").mockReturnValue(null);
      const result = resolveBin("");
      expect(result.isNone()).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it("[negative] returns None for an absolute path input without calling Bun.which", () => {
      const spy = spyOn(Bun, "which").mockReturnValue(null);
      const result = resolveBin("/bin/sh");
      expect(result.isNone()).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it("[negative] returns None for a relative path input without calling Bun.which", () => {
      const spy = spyOn(Bun, "which").mockReturnValue(null);
      const result = resolveBin("./sh");
      expect(result.isNone()).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it("[negative] returns None for a path containing slashes without calling Bun.which", () => {
      const spy = spyOn(Bun, "which").mockReturnValue(null);
      const result = resolveBin("foo/bar");
      expect(result.isNone()).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

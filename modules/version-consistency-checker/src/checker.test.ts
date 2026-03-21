import { describe, expect, it } from "bun:test";

import { checkConsistency } from "./checker.ts";

describe("checkConsistency", () => {
  describe("when all versions match", () => {
    it("[positive] returns an empty array when nix and one source agree", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0", python: "3.12.0" },
        { mise: { node: "20.0.0", python: "3.12.0" } },
      );
      expect(mismatches).toEqual([]);
    });

    it("[positive] returns an empty array when nix and multiple sources all agree", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        {
          mise: { node: "20.0.0" },
          other: { node: "20.0.0" },
        },
      );
      expect(mismatches).toEqual([]);
    });
  });

  describe("when versions mismatch", () => {
    it("[negative] returns a mismatch when a source version differs from nix", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        { mise: { node: "18.0.0" } },
      );
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0]).toEqual({
        tool: "node",
        nixVersion: "20.0.0",
        mismatchedSources: { mise: "18.0.0" },
      });
    });

    it("[negative] collects mismatches from multiple sources for the same tool", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        {
          mise: { node: "18.0.0" },
          other: { node: "19.0.0" },
        },
      );
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0]).toEqual({
        tool: "node",
        nixVersion: "20.0.0",
        mismatchedSources: { mise: "18.0.0", other: "19.0.0" },
      });
    });

    it("[negative] only includes mismatching sources in mismatchedSources", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        {
          mise: { node: "20.0.0" },
          other: { node: "19.0.0" },
        },
      );
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0]).toEqual({
        tool: "node",
        nixVersion: "20.0.0",
        mismatchedSources: { other: "19.0.0" },
      });
    });

    it("[negative] returns one mismatch entry per mismatched tool", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0", python: "3.12.0" },
        { mise: { node: "18.0.0", python: "3.11.0" } },
      );
      expect(mismatches).toHaveLength(2);
      const tools = mismatches.map((m) => m.tool);
      expect(tools).toContain("node");
      expect(tools).toContain("python");
    });
  });

  describe("tool name normalization", () => {
    it("[positive] normalizes source tool names before comparison", () => {
      // mise may report "npm:node" which should normalize to "node"
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        { mise: { "npm:node": "20.0.0" } },
      );
      expect(mismatches).toEqual([]);
    });

    it("[positive] normalizes scoped package names with slashes", () => {
      // e.g. "cargo:github.com/rust-lang/rustfmt" → "rustfmt"
      const mismatches = checkConsistency(
        { rustfmt: "1.0.0" },
        { mise: { "cargo:github.com/rust-lang/rustfmt": "1.0.0" } },
      );
      expect(mismatches).toEqual([]);
    });

    it("[negative] reports a mismatch when normalized names differ in version", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        { mise: { "npm:node": "18.0.0" } },
      );
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0]).toEqual({
        tool: "node",
        nixVersion: "20.0.0",
        mismatchedSources: { mise: "18.0.0" },
      });
    });

    it("[positive] uses the last value when two source keys normalize to the same name", () => {
      // "npm:node" and "node" both normalize to "node"; last entry wins
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        { mise: { "npm:node": "18.0.0", node: "20.0.0" } },
      );
      // "node" entry appears last and matches nix → no mismatch
      expect(mismatches).toEqual([]);
    });

    it("[positive] ignores source entries that normalize to an empty string", () => {
      // "npm:foo/" normalizes to "" which never matches any nix tool name
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        { mise: { "npm:foo/": "1.0.0", node: "20.0.0" } },
      );
      expect(mismatches).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("[positive] returns an empty array when nix has no tools", () => {
      const mismatches = checkConsistency(
        {},
        { mise: { node: "20.0.0" } },
      );
      expect(mismatches).toEqual([]);
    });

    it("[positive] returns an empty array when no sources are provided", () => {
      const mismatches = checkConsistency({ node: "20.0.0" }, {});
      expect(mismatches).toEqual([]);
    });

    it("[positive] returns an empty array when a source has an empty version map", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        { mise: {} },
      );
      expect(mismatches).toEqual([]);
    });

    it("[positive] ignores source tools that are not present in nix", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0" },
        { mise: { node: "20.0.0", python: "3.12.0" } },
      );
      expect(mismatches).toEqual([]);
    });

    it("[positive] ignores nix tools that are not present in any source", () => {
      const mismatches = checkConsistency(
        { node: "20.0.0", python: "3.12.0" },
        { mise: { node: "20.0.0" } },
      );
      expect(mismatches).toEqual([]);
    });
  });
});

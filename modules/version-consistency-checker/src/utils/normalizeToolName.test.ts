import { describe, expect, it } from "bun:test";

import { normalizeToolName } from "./normalizeToolName.ts";

describe("normalizeToolName", () => {
  it("[positive] extracts package name after colon", () => {
    expect(normalizeToolName("npm:typescript")).toBe("typescript");
    expect(normalizeToolName("pip:black")).toBe("black");
  });

  it("[positive] extracts the last segment after slash", () => {
    expect(normalizeToolName("cargo:ripgrep/rg")).toBe("rg");
    expect(normalizeToolName("go:github.com/foo/bar/baz")).toBe("baz");
  });

  it("[positive] returns the original name if no colon or slash is present", () => {
    expect(normalizeToolName("nodejs")).toBe("nodejs");
    expect(normalizeToolName("python")).toBe("python");
  });

  it("[positive] applies both colon and slash rules together", () => {
    expect(normalizeToolName("cargo:github.com/rust-lang/rustfmt")).toBe(
      "rustfmt",
    );
  });

  it("[positive] ignores slashes before the colon", () => {
    expect(normalizeToolName("foo/bar:baz")).toBe("baz");
  });

  it("[positive] splits only on the first colon when multiple colons are present", () => {
    expect(normalizeToolName("a:b:c")).toBe("b:c");
  });

  it("[negative] returns empty string for empty input", () => {
    expect(normalizeToolName("")).toBe("");
  });

  it("[negative] returns empty string when the key ends with a slash", () => {
    expect(normalizeToolName("npm:foo/")).toBe("");
    expect(normalizeToolName("foo/")).toBe("");
  });

  it("[negative] returns empty string for colon-only input", () => {
    expect(normalizeToolName(":")).toBe("");
  });

  it("[negative] returns empty string for slash-only input", () => {
    expect(normalizeToolName("/")).toBe("");
  });
});

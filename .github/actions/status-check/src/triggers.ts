// Parsing of a workflow's `on:` trigger definition.

export type OnValue = | string
  | string[]
  | Record<string, unknown>
  | undefined
  | null;

// Whether an `on:` value declares the `merge_group` trigger, in any of the
// forms a workflow may use: a bare string, a sequence, or a mapping.
export const hasMergeGroupTrigger = (on: OnValue): boolean => {
  if (typeof on === "string") return on === "merge_group";
  if (Array.isArray(on)) return on.includes("merge_group");
  if (on && typeof on === "object") return "merge_group" in on;
  return false;
};

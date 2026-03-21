import type { ProviderFactory } from "./base.ts";

import { miseProviderFactory } from "./mise.ts";
import { nixProviderFactory } from "./nix.ts";

export const providers: ProviderFactory[] = [
  nixProviderFactory,
  miseProviderFactory,
];

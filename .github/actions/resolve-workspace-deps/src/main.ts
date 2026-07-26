import { waitForPublish } from "./registry.ts";
import { resolveWorkspaceDeps } from "./resolve.ts";

const { PACKAGE_PATH } = process.env;

if (!PACKAGE_PATH) {
  throw new Error("PACKAGE_PATH is not set");
}

const resolved = await resolveWorkspaceDeps(process.cwd(), PACKAGE_PATH, waitForPublish);

for (const [name, range] of Object.entries(resolved)) {
  console.log(`Resolved ${name} -> ${range}`);
}

// npmレジストリに指定のversionが現れるまで待つ。

const REGISTRY = "https://registry.npmjs.org";
const ATTEMPTS = 30;
const INTERVAL_MS = 10_000;

export const waitForPublish = async (name: string, version: string): Promise<void> => {
  console.log(`Waiting for ${name}@${version} to be available on npm...`);

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const response = await fetch(`${REGISTRY}/${name}/${version}`, { method: "HEAD" });
    if (response.ok) {
      console.log(`${name}@${version} is available.`);
      return;
    }
    if (attempt < ATTEMPTS) {
      await Bun.sleep(INTERVAL_MS);
    }
  }

  throw new Error(`Timed out waiting for ${name}@${version} to be published`);
};

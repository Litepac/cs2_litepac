export type FixtureIndex = {
  files: Array<{
    fileName: string;
    label: string;
  }>;
};

export async function loadFixtureIndex(): Promise<FixtureIndex | null> {
  try {
    const response = await fetch(`/fixtures/index.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as FixtureIndex;
  } catch {
    return null;
  }
}

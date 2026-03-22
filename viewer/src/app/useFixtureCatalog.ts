import { useEffect, useState } from "react";

import { loadFixtureIndex, type FixtureIndex } from "../replay/fixtures";

export function useFixtureCatalog() {
  const [fixtures, setFixtures] = useState<FixtureIndex["files"]>([]);

  useEffect(() => {
    void loadFixtureIndex().then((index) => {
      setFixtures(index?.files ?? []);
    });
  }, []);

  return fixtures;
}

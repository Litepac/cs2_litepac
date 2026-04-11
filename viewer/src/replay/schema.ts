import Ajv2020 from "ajv/dist/2020";

import schema from "../../../schema/mastermind.replay.schema.json";
import type { Replay } from "./types";

// The replay schema is repo-owned and validated from a bundled JSON document. We keep
// strict mode off so Ajv does not reject newer schema keywords before the validator
// dependency is upgraded, while replay shape errors still fail validation normally.
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile<Replay>(schema);

export function validateReplay(value: unknown): { ok: true; replay: Replay } | { ok: false; errors: string[] } {
  if (validate(value)) {
    return { ok: true, replay: value };
  }

  return {
    ok: false,
    errors: summarizeErrors(
      (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`),
    ),
  };
}

function summarizeErrors(errors: string[]) {
  const unique = Array.from(new Set(errors));
  if (unique.length <= 6) {
    return unique;
  }

  return [
    ...unique.slice(0, 6),
    `... and ${unique.length - 6} more validation errors`,
  ];
}

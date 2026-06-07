import assert from "node:assert/strict";
import test from "node:test";

import { validateEnv } from "@/lib/env";

const requiredEnv = {
  DATABASE_URL: "postgresql://delavibe:delavibe@localhost:5432/delavibe?schema=public",
  NEXT_PUBLIC_STORE_NAME: "Dela's Vibe",
  NEXT_PUBLIC_STORE_ADDRESS: "Rua Teste, 123",
  NEXT_PUBLIC_STORE_PHONE: "(00) 00000-0000",
};

test("validateEnv: aceita NODE_ENV homolog", () => {
  const result = validateEnv({
    ...requiredEnv,
    NODE_ENV: "homolog",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.env.NODE_ENV, "homolog");
  }
});

test("validateEnv: rejeita NODE_ENV desconhecido", () => {
  const result = validateEnv({
    ...requiredEnv,
    NODE_ENV: "staging",
  });

  assert.equal(result.ok, false);
});

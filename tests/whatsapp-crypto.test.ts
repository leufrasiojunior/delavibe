import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { encryptApiKey, decryptApiKey, assertEncryptionKeyAvailable } from "@/lib/utils/crypto";

function setValidKey() {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
}

function clearKey() {
  delete process.env.APP_ENCRYPTION_KEY;
}

test("whatsapp-crypto: roundtrip encrypt then decrypt", () => {
  setValidKey();
  try {
    const plaintext = "my-secret-apikey-value-12345";
    const encrypted = encryptApiKey(plaintext);
    const decrypted = decryptApiKey(encrypted);
    assert.equal(decrypted, plaintext);
  } finally {
    clearKey();
  }
});

test("whatsapp-crypto: assertEncryptionKeyAvailable throws when env var is absent", () => {
  clearKey();
  assert.throws(
    () => assertEncryptionKeyAvailable(),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as unknown as { code: string }).code, "encryption_config_missing");
      assert.equal((err as unknown as { status: number }).status, 500);
      return true;
    },
  );
});

test("whatsapp-crypto: assertEncryptionKeyAvailable throws when key decodes to less than 32 bytes", () => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(16).toString("base64");
  try {
    assert.throws(
      () => assertEncryptionKeyAvailable(),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal((err as unknown as { code: string }).code, "encryption_config_missing");
        assert.equal((err as unknown as { status: number }).status, 500);
        return true;
      },
    );
  } finally {
    clearKey();
  }
});

test("whatsapp-crypto: tampering with ciphertext is detected", () => {
  setValidKey();
  try {
    const encrypted = encryptApiKey("secret-value");
    const parts = encrypted.split(":");
    const tampered = parts[2].split("");
    // Flip one hex char
    tampered[0] = tampered[0] === "a" ? "b" : "a";
    const tamperedBlob = `${parts[0]}:${parts[1]}:${tampered.join("")}`;
    assert.throws(
      () => decryptApiKey(tamperedBlob),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal((err as unknown as { code: string }).code, "ciphertext_tampered");
        assert.equal((err as unknown as { status: number }).status, 500);
        return true;
      },
    );
  } finally {
    clearKey();
  }
});

test("whatsapp-crypto: output format has exactly 3 colon-separated parts", () => {
  setValidKey();
  try {
    const encrypted = encryptApiKey("test");
    const parts = encrypted.split(":");
    assert.equal(parts.length, 3);
  } finally {
    clearKey();
  }
});

test("whatsapp-crypto: encrypting same string twice produces different outputs", () => {
  setValidKey();
  try {
    const a = encryptApiKey("same-value");
    const b = encryptApiKey("same-value");
    assert.notEqual(a, b);
  } finally {
    clearKey();
  }
});

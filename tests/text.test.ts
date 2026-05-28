import assert from "node:assert/strict";
import test from "node:test";

import { normalizeText } from "@/lib/utils/text";

test("normalizeText: vazio", () => {
  assert.equal(normalizeText(""), "");
});

test("normalizeText: lowercase simples", () => {
  assert.equal(normalizeText("Cerveja"), "cerveja");
  assert.equal(normalizeText("CACHACA"), "cachaca");
});

test("normalizeText: remove acentos agudos", () => {
  assert.equal(normalizeText("Acai"), "acai");
  assert.equal(normalizeText("CAFÉ"), "cafe");
  assert.equal(normalizeText("Pó"), "po");
});

test("normalizeText: remove acentos circunflexo e til", () => {
  assert.equal(normalizeText("Salgação"), "salgacao");
  assert.equal(normalizeText("Acentuação"), "acentuacao");
  assert.equal(normalizeText("Mêses"), "meses");
  assert.equal(normalizeText("Pão"), "pao");
});

test("normalizeText: cedilha", () => {
  assert.equal(normalizeText("Açaí"), "acai");
  assert.equal(normalizeText("FRANÇA"), "franca");
});

test("normalizeText: mix de acentos e letras", () => {
  assert.equal(normalizeText("Águia Imperial"), "aguia imperial");
  assert.equal(normalizeText("Bebida Não Alcoólica"), "bebida nao alcoolica");
});

test("normalizeText: preserva caracteres ASCII e espacos", () => {
  assert.equal(normalizeText("Hello World 123"), "hello world 123");
  assert.equal(normalizeText("ABC-XYZ_001"), "abc-xyz_001");
});

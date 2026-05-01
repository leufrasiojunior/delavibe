import { z } from "zod";

import { parseMoneyValue } from "@/lib/utils/money";

type EmptyResult = "undefined" | "null";

function coerceEmptyValue(value: unknown, emptyResult: EmptyResult) {
  if (value == null) {
    return emptyResult === "null" ? null : undefined;
  }

  if (typeof value === "string" && value.trim() === "") {
    return emptyResult === "null" ? null : undefined;
  }

  return value;
}

function coerceMoney(value: unknown, emptyResult: EmptyResult) {
  const rawValue = coerceEmptyValue(value, emptyResult);

  if (rawValue == null) {
    return rawValue;
  }

  const parsed = parseMoneyValue(rawValue);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function coerceInteger(value: unknown, emptyResult: EmptyResult) {
  const rawValue = coerceEmptyValue(value, emptyResult);

  if (rawValue == null) {
    return rawValue;
  }

  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue) ? rawValue : Number.NaN;
  }

  if (typeof rawValue === "string") {
    const parsed = Number(rawValue.trim());
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

export function requiredMoneyField(messages: {
  required: string;
  invalid: string;
  min?: string;
}) {
  return z.preprocess(
    (value) => coerceMoney(value, "undefined"),
    z
      .number({
        required_error: messages.required,
        invalid_type_error: messages.invalid,
      })
      .min(0, messages.min ?? messages.invalid),
  );
}

export function optionalMoneyField(messages: {
  invalid: string;
  positive?: string;
  min?: string;
}) {
  return z.preprocess(
    (value) => coerceMoney(value, "null"),
    z
      .number({
        invalid_type_error: messages.invalid,
      })
      .min(0, messages.min ?? messages.invalid)
      .nullable()
      .optional(),
  );
}

export function requiredPositiveMoneyField(messages: {
  required: string;
  invalid: string;
  positive: string;
}) {
  return z.preprocess(
    (value) => coerceMoney(value, "undefined"),
    z
      .number({
        required_error: messages.required,
        invalid_type_error: messages.invalid,
      })
      .positive(messages.positive),
  );
}

export function optionalPositiveMoneyField(messages: {
  invalid: string;
  positive: string;
}) {
  return z.preprocess(
    (value) => coerceMoney(value, "null"),
    z
      .number({
        invalid_type_error: messages.invalid,
      })
      .positive(messages.positive)
      .nullable()
      .optional(),
  );
}

export function requiredIntegerField(messages: {
  required: string;
  invalid: string;
  min?: { value: number; message: string };
  positive?: string;
}) {
  const schema = z.preprocess(
    (value) => coerceInteger(value, "undefined"),
    z.number({
      required_error: messages.required,
      invalid_type_error: messages.invalid,
    }).int(messages.invalid),
  );

  if (messages.positive) {
    return schema.refine((value) => value > 0, messages.positive);
  }

  if (messages.min) {
    return schema.refine((value) => value >= messages.min!.value, messages.min.message);
  }

  return schema;
}

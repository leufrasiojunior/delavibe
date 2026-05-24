import assert from "node:assert/strict";
import test from "node:test";

import { DeliveryMode } from "@prisma/client";

import { guestCustomerInputSchema } from "@/lib/schemas/customer";
import {
  webOrderCreateInputSchema,
  webOrderPublicCreateInputSchema,
} from "@/lib/schemas/web-order";

const validGuest = {
  name: "Maria Cliente",
  email: "maria@exemplo.com",
  phone: "(11) 91234-5678",
  consentDataProcessing: true,
  consentMarketing: false,
  policyVersion: "1.0-2026-05",
};

const validItems = [{ productId: "cabc1234567890abcdefghijk", quantity: 2 }];

const validAddress = {
  street: "Rua dos Bobos",
  number: "0",
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
  zip: "01001000",
};

test("guestCustomerInputSchema valida e normaliza email + telefone", async () => {
  const parsed = await guestCustomerInputSchema.parseAsync({
    ...validGuest,
    email: "Maria@Exemplo.com",
  });
  assert.equal(parsed.email, "maria@exemplo.com");
  assert.equal(parsed.phone, "11912345678");
});

test("guestCustomerInputSchema exige consent obrigatório", async () => {
  await assert.rejects(
    guestCustomerInputSchema.parseAsync({ ...validGuest, consentDataProcessing: false }),
  );
});

test("webOrderCreateInputSchema PICKUP aceita sem endereço", async () => {
  const parsed = await webOrderCreateInputSchema.parseAsync({
    items: validItems,
    deliveryMode: DeliveryMode.PICKUP,
  });
  assert.equal(parsed.deliveryMode, DeliveryMode.PICKUP);
});

test("webOrderCreateInputSchema DELIVERY exige endereço", async () => {
  await assert.rejects(
    webOrderCreateInputSchema.parseAsync({
      items: validItems,
      deliveryMode: DeliveryMode.DELIVERY,
    }),
  );
});

test("webOrderCreateInputSchema DELIVERY com address inline aceita", async () => {
  const parsed = await webOrderCreateInputSchema.parseAsync({
    items: validItems,
    deliveryMode: DeliveryMode.DELIVERY,
    address: validAddress,
  });
  assert.equal(parsed.deliveryMode, DeliveryMode.DELIVERY);
});

test("webOrderPublicCreateInputSchema aceita guest PICKUP completo", async () => {
  const parsed = await webOrderPublicCreateInputSchema.parseAsync({
    items: validItems,
    deliveryMode: DeliveryMode.PICKUP,
    guestCustomer: validGuest,
  });
  assert.equal(parsed.guestCustomer?.email, "maria@exemplo.com");
});

test("webOrderPublicCreateInputSchema DELIVERY exige addressSnapshot", async () => {
  await assert.rejects(
    webOrderPublicCreateInputSchema.parseAsync({
      items: validItems,
      deliveryMode: DeliveryMode.DELIVERY,
      guestCustomer: validGuest,
    }),
  );
});

test("webOrderPublicCreateInputSchema createAccount exige senha + confirmação iguais", async () => {
  await assert.rejects(
    webOrderPublicCreateInputSchema.parseAsync({
      items: validItems,
      deliveryMode: DeliveryMode.PICKUP,
      guestCustomer: validGuest,
      createAccount: true,
    }),
  );

  await assert.rejects(
    webOrderPublicCreateInputSchema.parseAsync({
      items: validItems,
      deliveryMode: DeliveryMode.PICKUP,
      guestCustomer: validGuest,
      createAccount: true,
      password: "senha1234",
      confirmPassword: "outraSenha1",
    }),
  );

  const parsed = await webOrderPublicCreateInputSchema.parseAsync({
    items: validItems,
    deliveryMode: DeliveryMode.PICKUP,
    guestCustomer: validGuest,
    createAccount: true,
    password: "senha1234",
    confirmPassword: "senha1234",
  });
  assert.equal(parsed.createAccount, true);
});

test("webOrderPublicCreateInputSchema createAccount exige guestCustomer", async () => {
  await assert.rejects(
    webOrderPublicCreateInputSchema.parseAsync({
      items: validItems,
      deliveryMode: DeliveryMode.PICKUP,
      createAccount: true,
      password: "senha1234",
      confirmPassword: "senha1234",
    }),
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { WebOrderStatus } from "@prisma/client";

import {
  customerLoginInputSchema,
  customerRegisterInputSchema,
} from "@/lib/schemas/customer";
import { customerAddressInputSchema } from "@/lib/schemas/customer-address";
import {
  webOrderCreateInputSchema,
  webOrderDeliveryFeeInputSchema,
  webOrderListFiltersSchema,
  webOrderStatusTransitionSchema,
} from "@/lib/schemas/web-order";
import {
  cancelingRevertsStock,
  isTerminalStatus,
  isValidTransition,
} from "@/lib/utils/web-order-status";
import {
  normalizeCep,
  normalizeEmail,
  normalizePhone,
} from "@/lib/utils/strings";

const validRegister = {
  name: "Maria Cliente",
  email: "Maria@Exemplo.com",
  phone: "(11) 91234-5678",
  password: "senha1234",
  consentDataProcessing: true,
  consentMarketing: false,
  policyVersion: "1.0-2026-05",
};

test("normalizeEmail aplica lowercase e trim", () => {
  assert.equal(normalizeEmail("  User@Email.COM  "), "user@email.com");
});

test("normalizePhone deixa apenas dígitos", () => {
  assert.equal(normalizePhone("+55 (11) 91234-5678"), "5511912345678");
  assert.equal(normalizePhone("11912345678"), "11912345678");
});

test("normalizeCep deixa apenas dígitos", () => {
  assert.equal(normalizeCep("01234-567"), "01234567");
  assert.equal(normalizeCep("abc"), "");
});

test("customerRegisterInputSchema aceita payload válido e normaliza email/telefone", async () => {
  const parsed = await customerRegisterInputSchema.parseAsync(validRegister);
  assert.equal(parsed.email, "maria@exemplo.com");
  assert.equal(parsed.phone, "11912345678");
});

test("customerRegisterInputSchema rejeita consent obrigatório ausente", async () => {
  await assert.rejects(
    customerRegisterInputSchema.parseAsync({ ...validRegister, consentDataProcessing: false }),
  );
});

test("customerRegisterInputSchema rejeita senha sem letra ou número", async () => {
  await assert.rejects(
    customerRegisterInputSchema.parseAsync({ ...validRegister, password: "12345678" }),
  );
  await assert.rejects(
    customerRegisterInputSchema.parseAsync({ ...validRegister, password: "senhasenha" }),
  );
  await assert.rejects(
    customerRegisterInputSchema.parseAsync({ ...validRegister, password: "abc12" }),
  );
});

test("customerRegisterInputSchema rejeita telefone com menos de 10 dígitos", async () => {
  await assert.rejects(
    customerRegisterInputSchema.parseAsync({ ...validRegister, phone: "12345" }),
  );
});

test("customerLoginInputSchema aceita email + senha", async () => {
  const parsed = await customerLoginInputSchema.parseAsync({
    email: "user@example.com",
    password: "anything",
  });
  assert.equal(parsed.email, "user@example.com");
});

test("customerAddressInputSchema aceita endereço completo", async () => {
  const parsed = await customerAddressInputSchema.parseAsync({
    street: "Rua dos Bobos",
    number: "0",
    complement: "Apto 1",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "sp",
    zip: "01001-000",
    isDefault: true,
  });
  assert.equal(parsed.state, "SP");
  assert.equal(parsed.zip, "01001000");
});

test("customerAddressInputSchema rejeita UF inválida", async () => {
  await assert.rejects(
    customerAddressInputSchema.parseAsync({
      street: "X", number: "1", neighborhood: "Y", city: "Z", state: "XX", zip: "01001000",
    }),
  );
});

test("customerAddressInputSchema rejeita CEP com tamanho errado", async () => {
  await assert.rejects(
    customerAddressInputSchema.parseAsync({
      street: "X", number: "1", neighborhood: "Y", city: "Z", state: "SP", zip: "1234",
    }),
  );
});

test("isValidTransition aceita transições válidas e rejeita inválidas", () => {
  assert.equal(isValidTransition(WebOrderStatus.PENDING_PAYMENT, WebOrderStatus.PREPARING), true);
  assert.equal(isValidTransition(WebOrderStatus.PENDING_PAYMENT, WebOrderStatus.CANCELLED), true);
  assert.equal(isValidTransition(WebOrderStatus.PENDING_PAYMENT, WebOrderStatus.PAID), false);
  assert.equal(isValidTransition(WebOrderStatus.PREPARING, WebOrderStatus.READY), true);
  assert.equal(isValidTransition(WebOrderStatus.READY, WebOrderStatus.OUT_FOR_DELIVERY), true);
  assert.equal(isValidTransition(WebOrderStatus.READY, WebOrderStatus.DELIVERED), false);
  assert.equal(isValidTransition(WebOrderStatus.OUT_FOR_DELIVERY, WebOrderStatus.PAID), true);
  assert.equal(isValidTransition(WebOrderStatus.PAID, WebOrderStatus.DELIVERED), true);
  assert.equal(isValidTransition(WebOrderStatus.DELIVERED, WebOrderStatus.CANCELLED), false);
  assert.equal(isValidTransition(WebOrderStatus.CANCELLED, WebOrderStatus.PAID), false);
});

test("isTerminalStatus marca DELIVERED e CANCELLED como terminais", () => {
  assert.equal(isTerminalStatus(WebOrderStatus.DELIVERED), true);
  assert.equal(isTerminalStatus(WebOrderStatus.CANCELLED), true);
  assert.equal(isTerminalStatus(WebOrderStatus.PENDING_PAYMENT), false);
});

test("cancelingRevertsStock cobre estados não-terminais com itens", () => {
  assert.equal(cancelingRevertsStock(WebOrderStatus.PENDING_PAYMENT), true);
  assert.equal(cancelingRevertsStock(WebOrderStatus.READY), true);
  assert.equal(cancelingRevertsStock(WebOrderStatus.DELIVERED), false);
  assert.equal(cancelingRevertsStock(WebOrderStatus.CANCELLED), false);
});

test("webOrderStatusTransitionSchema exige nota quando cancelando", async () => {
  await assert.rejects(
    webOrderStatusTransitionSchema.parseAsync({ toStatus: WebOrderStatus.CANCELLED }),
  );
  await assert.rejects(
    webOrderStatusTransitionSchema.parseAsync({
      toStatus: WebOrderStatus.CANCELLED,
      notes: "ab",
    }),
  );

  const parsed = await webOrderStatusTransitionSchema.parseAsync({
    toStatus: WebOrderStatus.CANCELLED,
    notes: "Cliente desistiu",
  });
  assert.equal(parsed.notes, "Cliente desistiu");
});

test("webOrderStatusTransitionSchema aceita transição não-cancelamento sem nota", async () => {
  const parsed = await webOrderStatusTransitionSchema.parseAsync({
    toStatus: WebOrderStatus.PREPARING,
  });
  assert.equal(parsed.toStatus, WebOrderStatus.PREPARING);
});

test("webOrderStatusTransitionSchema aceita notes: null em transição não-cancelamento", async () => {
  const parsed = await webOrderStatusTransitionSchema.parseAsync({
    toStatus: WebOrderStatus.PREPARING,
    notes: null,
  });
  assert.equal(parsed.toStatus, WebOrderStatus.PREPARING);
  assert.equal(parsed.notes, null);
});

test("webOrderStatusTransitionSchema exige payments ao marcar como pago", async () => {
  await assert.rejects(
    webOrderStatusTransitionSchema.parseAsync({ toStatus: WebOrderStatus.PAID }),
  );
  await assert.rejects(
    webOrderStatusTransitionSchema.parseAsync({
      toStatus: WebOrderStatus.PAID,
      payments: [],
    }),
  );
  const parsed = await webOrderStatusTransitionSchema.parseAsync({
    toStatus: WebOrderStatus.PAID,
    payments: [{ method: "cash", amountCents: 5000 }],
  });
  assert.equal(parsed.toStatus, WebOrderStatus.PAID);
  assert.deepEqual(parsed.payments, [{ method: "cash", amountCents: 5000 }]);
});

test("webOrderStatusTransitionSchema aceita varias formas com valores", async () => {
  const parsed = await webOrderStatusTransitionSchema.parseAsync({
    toStatus: WebOrderStatus.PAID,
    payments: [
      { method: "cash", amountCents: 3000 },
      { method: "pix", amountCents: 2000 },
    ],
  });
  assert.equal(parsed.payments?.length, 2);
});

test("webOrderStatusTransitionSchema rejeita forma de pagamento duplicada", async () => {
  await assert.rejects(
    webOrderStatusTransitionSchema.parseAsync({
      toStatus: WebOrderStatus.PAID,
      payments: [
        { method: "cash", amountCents: 1000 },
        { method: "cash", amountCents: 500 },
      ],
    }),
  );
});

test("webOrderStatusTransitionSchema rejeita amountCents <= 0", async () => {
  await assert.rejects(
    webOrderStatusTransitionSchema.parseAsync({
      toStatus: WebOrderStatus.PAID,
      payments: [{ method: "cash", amountCents: 0 }],
    }),
  );
});

test("webOrderCreateInputSchema exige pelo menos um item", async () => {
  await assert.rejects(webOrderCreateInputSchema.parseAsync({ items: [] }));
});

test("webOrderCreateInputSchema rejeita quantidade < 1", async () => {
  await assert.rejects(
    webOrderCreateInputSchema.parseAsync({
      items: [{ productId: "ckxyz0000000000000000000a", quantity: 0 }],
    }),
  );
});

test("webOrderDeliveryFeeInputSchema converte frete para centavos e aceita vazio", async () => {
  const parsed = await webOrderDeliveryFeeInputSchema.parseAsync({ deliveryFee: "R$ 12,50" });
  assert.equal(parsed.deliveryFee, 1250);

  const empty = await webOrderDeliveryFeeInputSchema.parseAsync({ deliveryFee: "" });
  assert.equal(empty.deliveryFee, 0);

  await assert.rejects(
    webOrderDeliveryFeeInputSchema.parseAsync({ deliveryFee: "R$ -1,00" }),
    /frete não pode ser negativo/i,
  );
});

test("webOrderListFiltersSchema aplica defaults de paginação", async () => {
  const parsed = await webOrderListFiltersSchema.parseAsync({});
  assert.equal(parsed.take, 50);
  assert.equal(parsed.skip, 0);
});

test("webOrderListFiltersSchema rejeita take > 200", async () => {
  await assert.rejects(webOrderListFiltersSchema.parseAsync({ take: 500 }));
});

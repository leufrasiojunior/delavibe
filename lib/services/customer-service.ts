import bcrypt from "bcryptjs";
import { Prisma, type Customer } from "@prisma/client";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  type CustomerDto,
  type CustomerPublicDto,
} from "@/lib/schemas/customer";
import { logAuditEvent } from "@/lib/services/audit-service";

const PASSWORD_BCRYPT_COST = 12;
const ANONYMIZED_NAME = "Cliente removido";

function toCustomerPublicDto(customer: Customer): CustomerPublicDto {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    consentDataProcessingAt: customer.consentDataProcessingAt.toISOString(),
    consentMarketingAt: customer.consentMarketingAt?.toISOString() ?? null,
    consentPolicyVersion: customer.consentPolicyVersion,
    createdAt: customer.createdAt.toISOString(),
  };
}

function toCustomerDto(customer: Customer): CustomerDto {
  return {
    ...toCustomerPublicDto(customer),
    deletedAt: customer.deletedAt?.toISOString() ?? null,
    updatedAt: customer.updatedAt.toISOString(),
  };
}

type CreateCustomerInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  consentDataProcessing: true;
  consentMarketing?: boolean;
  policyVersion: string;
};

export async function createCustomer(input: CreateCustomerInput, ipAddress: string) {
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_BCRYPT_COST);
  const now = new Date();

  try {
    const customer = await db.customer.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        consentDataProcessingAt: now,
        consentMarketingAt: input.consentMarketing ? now : null,
        consentPolicyVersion: input.policyVersion,
        consentIpAddress: ipAddress,
      },
    });

    await logAuditEvent({
      actorUserId: null,
      action: "customer.register",
      entityType: "customer",
      entityId: customer.id,
      ipAddress,
      metadata: { consentMarketing: !!input.consentMarketing, policyVersion: input.policyVersion },
    });

    logger.info("customer_registered", { customerId: customer.id });
    return toCustomerDto(customer);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        409,
        "customer_email_in_use",
        "Este e-mail já está cadastrado.",
        null,
        "Faça login para usar esta conta.",
      );
    }

    throw error;
  }
}

export async function authenticateCustomer(
  email: string,
  password: string,
  ipAddress: string,
): Promise<Customer> {
  const customer = await db.customer.findUnique({ where: { email } });
  const isValid =
    customer && customer.deletedAt === null
      ? await bcrypt.compare(password, customer.passwordHash)
      : false;

  if (!isValid || !customer) {
    await logAuditEvent({
      action: "customer.login.failed",
      entityType: "customer",
      entityId: customer?.id ?? null,
      ipAddress,
      metadata: { reason: "invalid_credentials" },
    });

    logger.warn("customer_login_failed", { ipAddress });

    throw new AppError(
      401,
      "invalid_credentials",
      "E-mail ou senha inválidos.",
      null,
      "Verifique seus dados e tente novamente.",
    );
  }

  await logAuditEvent({
    action: "customer.login",
    entityType: "customer",
    entityId: customer.id,
    ipAddress,
  });

  logger.info("customer_login_success", { customerId: customer.id });
  return customer;
}

export async function getCustomerById(id: string) {
  const customer = await db.customer.findUnique({ where: { id } });
  return customer ? toCustomerDto(customer) : null;
}

export async function softDeleteCustomer(
  customerId: string,
  reason: string,
  actorUserId: string | null,
  ipAddress: string,
): Promise<CustomerDto> {
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.customer.findUnique({ where: { id: customerId } });

    if (!existing) {
      throw new AppError(404, "customer_not_found", "Cliente não encontrado.");
    }

    if (existing.deletedAt !== null) {
      return existing;
    }

    const anonymizedEmail = `deleted-${existing.id}@anonymized.local`;

    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        deletedAt: new Date(),
        name: ANONYMIZED_NAME,
        email: anonymizedEmail,
        phone: "",
        passwordHash: "",
      },
    });

    await tx.customerSession.deleteMany({ where: { customerId } });
    return updated;
  });

  await logAuditEvent({
    actorUserId,
    action: "customer.deleted",
    entityType: "customer",
    entityId: customerId,
    ipAddress,
    metadata: { reason },
  });

  logger.info("customer_soft_deleted", { customerId, reason });
  return toCustomerDto(result);
}

export { toCustomerDto, toCustomerPublicDto };

import bcrypt from "bcryptjs";

import { AppError } from "@/lib/api/response";
import { assertRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import { createUserSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loginInputSchema } from "@/lib/schemas/auth";
import { logAuditEvent } from "@/lib/services/audit-service";
import { hasAdminAccount } from "@/lib/services/bootstrap-service";
import { normalizeText } from "@/lib/utils/strings";

export async function loginUser(rawInput: unknown, ipAddress: string) {
  if (!(await hasAdminAccount())) {
    throw new AppError(
      409,
      "initial_admin_required",
      "O sistema ainda não possui administrador configurado.",
      null,
      "Acesse /setup para criar o primeiro administrador antes de fazer login.",
    );
  }

  const input = await loginInputSchema.parseAsync(rawInput);
  const normalizedUsername = normalizeText(input.username).toLowerCase();
  const rateKey = `login:${normalizedUsername}:${ipAddress}`;

  assertRateLimit(rateKey, 5, 15 * 60 * 1000);

  const user = await db.user.findUnique({
    where: { username: normalizedUsername },
  });

  const isValid =
    user && user.isActive ? await bcrypt.compare(input.password, user.passwordHash) : false;

  if (!isValid || !user) {
    logger.warn("login_failed", {
      userId: user?.id ?? null,
      ipAddress,
      username: normalizedUsername,
    });

    await logAuditEvent({
      action: "login_failed",
      entityType: "user",
      entityId: user?.id,
      ipAddress,
      metadata: { username: normalizedUsername },
    });

    throw new AppError(
      401,
      "invalid_credentials",
      "Usuário ou senha inválidos.",
      null,
      "Revise o usuário informado ou tente novamente com a senha correta.",
    );
  }

  resetRateLimit(rateKey);

  const session = await createUserSession(user);

  logger.info("login_success", {
    userId: user.id,
    username: user.username,
    role: user.role,
    ipAddress,
  });

  await logAuditEvent({
    actorUserId: user.id,
    action: "login_success",
    entityType: "session",
    ipAddress,
  });

  return {
    session,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    },
  };
}

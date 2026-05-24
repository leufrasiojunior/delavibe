import bcrypt from "bcryptjs";

import { AppError } from "@/lib/api/response";
import { createUserSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { LoginInput } from "@/lib/schemas/auth";
import { logAuditEvent } from "@/lib/services/audit-service";
import { hasAdminAccount } from "@/lib/services/bootstrap-service";

export async function loginUser(input: LoginInput, ipAddress: string) {
  if (!(await hasAdminAccount())) {
    throw new AppError(
      409,
      "initial_admin_required",
      "O sistema ainda não possui administrador configurado.",
      null,
      "Acesse /admin/setup para criar o primeiro administrador antes de fazer login.",
    );
  }

  const user = await db.user.findUnique({
    where: { username: input.username },
  });

  const isValid =
    user && user.isActive ? await bcrypt.compare(input.password, user.passwordHash) : false;

  if (!isValid || !user) {
    logger.warn("login_failed", {
      userId: user?.id ?? null,
      ipAddress,
    });

    await logAuditEvent({
      action: "login_failed",
      entityType: "user",
      entityId: user?.id,
      ipAddress,
      metadata: { reason: "invalid_credentials" },
    });

    throw new AppError(
      401,
      "invalid_credentials",
      "Usuário ou senha inválidos.",
      null,
      "Revise o usuário informado ou tente novamente com a senha correta.",
    );
  }

  const session = await createUserSession(user);

  logger.info("login_success", {
    userId: user.id,
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

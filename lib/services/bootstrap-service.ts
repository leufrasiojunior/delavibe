import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { InitialAdminSetupInput } from "@/lib/schemas/auth";
import { logAuditEvent } from "@/lib/services/audit-service";

export async function hasAdminAccount() {
  const adminCount = await db.user.count({
    where: { role: Role.admin },
  });

  return adminCount > 0;
}

export async function createInitialAdmin(input: InitialAdminSetupInput, ipAddress: string) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await db.$transaction(
      async (tx) => {
        const adminCount = await tx.user.count({
          where: { role: Role.admin },
        });

        if (adminCount > 0) {
          throw new AppError(
            409,
            "initial_admin_locked",
            "O administrador inicial já foi configurado.",
            null,
            "Faça login com a conta administrativa existente.",
          );
        }

        return tx.user.create({
          data: {
            name: input.name,
            username: input.username,
            passwordHash,
            role: Role.admin,
            isActive: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    logger.info("initial_admin_created", {
      userId: user.id,
      ipAddress,
    });

    await logAuditEvent({
      actorUserId: user.id,
      action: "initial_admin_created",
      entityType: "user",
      entityId: user.id,
      ipAddress,
      metadata: { bootstrap: true },
    });

    return user;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      throw new AppError(
        409,
        "initial_admin_locked",
        "O administrador inicial já foi configurado.",
        null,
        "Faça login com a conta administrativa existente.",
      );
    }

    throw error;
  }
}

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://delavibe:delavibe@localhost:5432/delavibe?schema=public";
const adapter = new PrismaPg({ connectionString });
const nodeEnv: string | undefined = process.env.NODE_ENV;
const isDevelopment = nodeEnv === "development";
const isProductionLike = nodeEnv === "production" || nodeEnv === "homolog";

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: isDevelopment ? ["warn", "error"] : ["error"],
  });

if (!isProductionLike) {
  globalForPrisma.prisma = db;
}

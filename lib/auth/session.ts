import { createHash, randomBytes } from "node:crypto";

import type { User } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import type { Role } from "@/lib/schemas/shared";
import { hasAdminAccount } from "@/lib/services/bootstrap-service";

const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS || "12");
const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE === "true";
const sessionCookieSameSite: "lax" | "strict" = sessionCookieSecure ? "strict" : "lax";
const sessionCookieName =
  process.env.SESSION_COOKIE_NAME || (sessionCookieSecure ? "__Host-pdv_session" : "pdv_session");
const csrfCookieName =
  process.env.CSRF_COOKIE_NAME || (sessionCookieSecure ? "__Host-pdv_csrf" : "pdv_csrf");

type SessionWithUser = Awaited<ReturnType<typeof findSessionByToken>>;

export type AuthSession = {
  sessionId: string;
  csrfToken: string;
  expiresAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    role: Role;
  };
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildSessionResponse(session: NonNullable<SessionWithUser>): AuthSession {
  return {
    sessionId: session.id,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt.toISOString(),
    user: {
      id: session.user.id,
      name: session.user.name,
      username: session.user.username,
      role: session.user.role,
    },
  };
}

function createOpaqueToken() {
  return randomBytes(48).toString("hex");
}

async function findSessionByToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date() || !session.user.isActive) {
    await db.session.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  return session;
}

export async function createUserSession(user: User) {
  const token = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      csrfToken,
      expiresAt,
      userId: user.id,
    },
  });

  return { token, csrfToken, expiresAt };
}

export function applySessionCookies(
  response: NextResponse,
  session: { token: string; csrfToken: string; expiresAt: Date },
) {
  response.cookies.set({
    name: sessionCookieName,
    value: session.token,
    httpOnly: true,
    sameSite: sessionCookieSameSite,
    secure: sessionCookieSecure,
    expires: session.expiresAt,
    path: "/",
  });

  response.cookies.set({
    name: csrfCookieName,
    value: session.csrfToken,
    httpOnly: false,
    sameSite: sessionCookieSameSite,
    secure: sessionCookieSecure,
    expires: session.expiresAt,
    path: "/",
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set({
    name: sessionCookieName,
    value: "",
    httpOnly: true,
    sameSite: sessionCookieSameSite,
    secure: sessionCookieSecure,
    expires: new Date(0),
    path: "/",
  });

  response.cookies.set({
    name: csrfCookieName,
    value: "",
    httpOnly: false,
    sameSite: sessionCookieSameSite,
    secure: sessionCookieSecure,
    expires: new Date(0),
    path: "/",
  });
}

function assertRole(role: Role, allowedRoles?: Role[]) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return;
  }

  if (!allowedRoles.includes(role)) {
    throw new AppError(
      403,
      "forbidden",
      "Você não tem permissão para executar esta ação.",
      null,
      "Faça login com um usuário administrador para continuar.",
    );
  }
}

export async function getSessionFromRequest(request: NextRequest, allowedRoles?: Role[]) {
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = await findSessionByToken(token);

  if (!session) {
    throw new AppError(
      401,
      "unauthorized",
      "Sua sessão expirou. Faça login novamente.",
      null,
      "Entre novamente no sistema para restaurar a sessão.",
    );
  }

  assertRole(session.user.role, allowedRoles);
  return buildSessionResponse(session);
}

export async function getOptionalSessionFromRequest(request: NextRequest, allowedRoles?: Role[]) {
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = await findSessionByToken(token);

  if (!session) {
    return null;
  }

  assertRole(session.user.role, allowedRoles);
  return buildSessionResponse(session);
}

export async function getOptionalServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = await findSessionByToken(token);
  return session ? buildSessionResponse(session) : null;
}

export async function requireServerSession(allowedRoles?: Role[]) {
  if (!(await hasAdminAccount())) {
    redirect("/admin/setup");
  }

  const session = await getOptionalServerSession();

  if (!session) {
    redirect("/admin/login");
  }

  assertRole(session.user.role, allowedRoles);
  return session;
}

export async function destroySessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const session = await findSessionByToken(token);

  if (!session) {
    return null;
  }

  await db.session.delete({
    where: { id: session.id },
  });

  return buildSessionResponse(session);
}

export function assertCsrfProtection(request: NextRequest, session: AuthSession) {
  if (request.method === "GET" || request.method === "HEAD") {
    return;
  }

  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = request.cookies.get(csrfCookieName)?.value;

  if (!headerToken || !cookieToken || headerToken !== cookieToken || headerToken !== session.csrfToken) {
    throw new AppError(
      403,
      "invalid_csrf",
      "A verificação de segurança da sessão falhou.",
      null,
      "Atualize a página e tente novamente.",
    );
  }
}

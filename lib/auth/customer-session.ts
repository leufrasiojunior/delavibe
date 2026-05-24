// Sessão de cliente final — separada da sessão admin/operator (lib/auth/session.ts).
// Helpers nomeados explicitamente com prefixo "Customer" para evitar confusão.
// Cookies, tabela DB e CSRF são independentes.

import { createHash, randomBytes } from "node:crypto";

import type { Customer } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";

const sessionTtlHours = Number(process.env.CUSTOMER_SESSION_TTL_HOURS || "168");
const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE === "true";
const sessionCookieSameSite: "lax" | "strict" = sessionCookieSecure ? "strict" : "lax";
const sessionCookieName =
  process.env.CUSTOMER_SESSION_COOKIE_NAME ||
  (sessionCookieSecure ? "__Host-customer_session" : "customer_session");
const csrfCookieName =
  process.env.CUSTOMER_CSRF_COOKIE_NAME ||
  (sessionCookieSecure ? "__Host-customer_csrf" : "customer_csrf");

export type CustomerAuthSession = {
  sessionId: string;
  csrfToken: string;
  expiresAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
};

type SessionWithCustomer = Awaited<ReturnType<typeof findCustomerSessionByToken>>;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createOpaqueToken() {
  return randomBytes(48).toString("hex");
}

function buildCustomerSessionResponse(session: NonNullable<SessionWithCustomer>): CustomerAuthSession {
  return {
    sessionId: session.id,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt.toISOString(),
    customer: {
      id: session.customer.id,
      name: session.customer.name,
      email: session.customer.email,
      phone: session.customer.phone,
    },
  };
}

async function findCustomerSessionByToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const session = await db.customerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { customer: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date() || session.customer.deletedAt !== null) {
    await db.customerSession.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  return session;
}

export async function createCustomerSession(customer: Customer) {
  const token = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);

  await db.customerSession.create({
    data: {
      tokenHash: hashToken(token),
      csrfToken,
      expiresAt,
      customerId: customer.id,
    },
  });

  return { token, csrfToken, expiresAt };
}

export function applyCustomerSessionCookies(
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

export function clearCustomerSessionCookies(response: NextResponse) {
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

export async function getCustomerSessionFromRequest(
  request: NextRequest,
): Promise<CustomerAuthSession> {
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = await findCustomerSessionByToken(token);

  if (!session) {
    throw new AppError(
      401,
      "customer_unauthorized",
      "Sua sessão de cliente expirou. Faça login novamente.",
      null,
      "Entre novamente para continuar.",
    );
  }

  return buildCustomerSessionResponse(session);
}

export async function getOptionalCustomerSessionFromRequest(
  request: NextRequest,
): Promise<CustomerAuthSession | null> {
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = await findCustomerSessionByToken(token);
  return session ? buildCustomerSessionResponse(session) : null;
}

export async function getOptionalServerCustomerSession(): Promise<CustomerAuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = await findCustomerSessionByToken(token);
  return session ? buildCustomerSessionResponse(session) : null;
}

export async function requireServerCustomerSession(): Promise<CustomerAuthSession> {
  const session = await getOptionalServerCustomerSession();

  if (!session) {
    redirect("/entrar");
  }

  return session;
}

export async function destroyCustomerSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const session = await findCustomerSessionByToken(token);

  if (!session) {
    return null;
  }

  await db.customerSession.delete({ where: { id: session.id } });
  return buildCustomerSessionResponse(session);
}

export function assertCustomerCsrfProtection(request: NextRequest, session: CustomerAuthSession) {
  if (request.method === "GET" || request.method === "HEAD") {
    return;
  }

  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = request.cookies.get(csrfCookieName)?.value;

  if (
    !headerToken ||
    !cookieToken ||
    headerToken !== cookieToken ||
    headerToken !== session.csrfToken
  ) {
    throw new AppError(
      403,
      "invalid_csrf",
      "A verificação de segurança da sessão de cliente falhou.",
      null,
      "Atualize a página e tente novamente.",
    );
  }
}

import type { NextRequest } from "next/server";

function shouldTrustProxyHeaders() {
  return process.env.TRUST_PROXY_HEADERS === "true";
}

export function getRequestIp(request: NextRequest) {
  if (shouldTrustProxyHeaders()) {
    const forwardedFor = request.headers.get("x-forwarded-for");

    if (forwardedFor) {
      return forwardedFor.split(",")[0]?.trim() || "local";
    }

    return request.headers.get("x-real-ip") || "local";
  }

  return request.headers.get("x-real-ip") || "local";
}

export function getRequestHost(request: NextRequest) {
  if (shouldTrustProxyHeaders()) {
    return request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
  }

  return request.headers.get("host") || request.nextUrl.host;
}

export function getRequestProtocol(request: NextRequest) {
  if (shouldTrustProxyHeaders()) {
    return request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  }

  return request.nextUrl.protocol.replace(":", "");
}

export function getExpectedOrigin(request: NextRequest) {
  const configuredOrigin = process.env.APP_ORIGIN?.trim().replace(/\/$/, "");

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return `${getRequestProtocol(request)}://${getRequestHost(request)}`;
}

export function normalizeOrigin(value: string) {
  return value.trim().replace(/\/$/, "");
}

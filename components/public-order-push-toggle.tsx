"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";
import {
  pushPublicKeyResponseSchema,
  pushSubscribeResponseSchema,
} from "@/lib/schemas/push";

type SupportState = "checking" | "unsupported" | "denied" | "default" | "active";

type PublicOrderPushToggleProps = {
  orderId: string;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function PublicOrderPushToggle({ orderId }: PublicOrderPushToggleProps) {
  const [state, setState] = useState<SupportState>("checking");
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storageKey = `dela-order-push:${orderId}`;

  const refreshState = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    const isRegisteredForOrder = (() => {
      try {
        return window.localStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    })();
    setState(subscription && isRegisteredForOrder && Notification.permission === "granted" ? "active" : "default");
  }, [storageKey]);

  useEffect(() => {
    void refreshState().catch(() => setState("default"));
  }, [refreshState]);

  const enable = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        setError("Permissão de notificação não concedida.");
        return;
      }

      const { publicKey } = await apiFetch(
        "/api/push/public-key",
        { method: "GET" },
        pushPublicKeyResponseSchema,
      );

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = subscription.toJSON();
      await apiFetch(
        `/api/web-orders/${orderId}/push/subscribe`,
        {
          method: "POST",
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
            userAgent: navigator.userAgent.slice(0, 512),
          }),
        },
        pushSubscribeResponseSchema,
      );

      setState("active");
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // localStorage indisponivel — a subscription continua persistida no backend.
      }
      setMessage("Notificações deste pedido ativadas.");
    } catch (err: unknown) {
      const fallback = "Falha ao ativar notificações do pedido.";
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setIsBusy(false);
    }
  }, [orderId, storageKey]);

  const disable = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await apiFetch(
          `/api/web-orders/${orderId}/push/subscribe`,
          {
            method: "DELETE",
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          },
          z.object({ ok: z.literal(true) }),
        );
        await subscription.unsubscribe();
      }
      setState("default");
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // localStorage indisponivel — o estado visual volta para default nesta sessao.
      }
      setMessage("Notificações deste pedido desativadas.");
    } catch (err: unknown) {
      const fallback = "Falha ao desativar notificações do pedido.";
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setIsBusy(false);
    }
  }, [orderId, storageKey]);

  if (state === "checking") {
    return null;
  }

  return (
    <div className="public-checkout-block">
      <h2>Atualizações do pedido</h2>
      {state === "unsupported" ? (
        <p className="muted">Este navegador não oferece suporte a notificações push.</p>
      ) : state === "denied" ? (
        <p className="form-error compact">
          As notificações estão bloqueadas. Reabilite nas configurações do navegador.
        </p>
      ) : state === "active" ? (
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary compact"
            onClick={disable}
            disabled={isBusy}
          >
            <BellOff size={16} aria-hidden />
            {isBusy ? "Desativando..." : "Desativar notificações"}
          </button>
        </div>
      ) : (
        <>
          <p className="muted">
            Receba um aviso quando o pedido sair para entrega e quando for finalizado.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button button-primary compact"
              onClick={enable}
              disabled={isBusy}
            >
              <Bell size={16} aria-hidden />
              {isBusy ? "Ativando..." : "Receber atualizações do pedido"}
            </button>
          </div>
        </>
      )}
      {message ? <p className="muted">{message}</p> : null}
      {error ? <p className="form-error compact">{error}</p> : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/components/toast";
import {
  pushPublicKeyResponseSchema,
  pushStatusResponseSchema,
  pushSubscribeResponseSchema,
} from "@/lib/schemas/push";

type SupportState = "checking" | "unsupported" | "denied" | "default" | "active";

const AUTO_PROMPT_SESSION_KEY = "dela-push-auto-prompt-attempted";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotificationToggle() {
  const [state, setState] = useState<SupportState>("checking");
  const [isBusy, setIsBusy] = useState(false);
  const toast = useToast();

  const refreshState = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const { active } = await apiFetch("/api/admin/push/status", { method: "GET" }, pushStatusResponseSchema);
      if (active && Notification.permission === "granted") {
        setState("active");
      } else {
        setState("default");
      }
    } catch {
      setState("default");
    }
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const enable = useCallback(async () => {
    setIsBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        toast.error("Permissao de notificacao negada.", undefined);
        return;
      }

      const { publicKey } = await apiFetch(
        "/api/admin/push/public-key",
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
        "/api/admin/push/subscribe",
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
      toast.success("Notificacoes ativadas.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao ativar notificacoes.";
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [toast]);

  // Auto-solicita permissao na primeira visita admin se ainda nao decidida.
  // Guard via sessionStorage para nao reprompar entre navegacoes na mesma sessao.
  useEffect(() => {
    if (state !== "default") return;
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(AUTO_PROMPT_SESSION_KEY)) return;
      sessionStorage.setItem(AUTO_PROMPT_SESSION_KEY, "1");
    } catch {
      // sessionStorage indisponivel — segue sem guard
    }
    void enable();
  }, [state, enable]);

  const disable = useCallback(async () => {
    setIsBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await apiFetch(
          "/api/admin/push/subscribe",
          {
            method: "DELETE",
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          },
          z.object({ ok: z.literal(true) }),
        );
        await subscription.unsubscribe();
      }
      setState("default");
      toast.info("Notificacoes desativadas.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao desativar notificacoes.";
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [toast]);

  if (state === "checking") {
    return null;
  }

  if (state === "unsupported") {
    return (
      <span className="push-toggle push-toggle--muted" title="Browser sem suporte a Web Push">
        <BellOff size={16} aria-hidden />
        Push indisponivel
      </span>
    );
  }

  if (state === "denied") {
    return (
      <span className="push-toggle push-toggle--muted" title="Notificacoes bloqueadas. Reabilite nas configuracoes do navegador.">
        <BellOff size={16} aria-hidden />
        Push bloqueado
      </span>
    );
  }

  if (state === "active") {
    return (
      <button
        type="button"
        className="push-toggle push-toggle--active"
        onClick={disable}
        disabled={isBusy}
        aria-label="Desativar notificacoes push"
      >
        <Bell size={16} aria-hidden />
        {isBusy ? "Desativando..." : "Notificacoes ativas"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="push-toggle"
      onClick={enable}
      disabled={isBusy}
      aria-label="Ativar notificacoes push de novos pedidos"
    >
      <BellOff size={16} aria-hidden />
      {isBusy ? "Ativando..." : "Ativar notificacoes"}
    </button>
  );
}

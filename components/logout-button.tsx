"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { apiFetch } from "@/lib/api/client";
import { z } from "zod";

const logoutResponseSchema = z.object({
  success: z.literal(true),
});

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    setError(null);

    startTransition(() => {
      void apiFetch("/api/auth/logout", { method: "POST" }, logoutResponseSchema)
        .then(() => {
          router.replace("/admin/login");
          router.refresh();
        })
        .catch((caughtError: unknown) => {
          setError(caughtError instanceof Error ? caughtError.message : "Falha ao encerrar a sessão.");
        });
    });
  }

  return (
    <div className="logout-wrapper">
      <button className="button button-secondary" onClick={handleLogout} disabled={isPending} type="button">
        {isPending ? "Saindo..." : "Sair"}
      </button>
      {error ? <p className="form-error compact">{error}</p> : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { apiFetch } from "@/lib/api/client";
import { loginResponseSchema } from "@/lib/schemas/auth";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);

    const payload = {
      username: String(formData.get("username") || ""),
      password: String(formData.get("password") || ""),
    };

    startTransition(() => {
      void apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }, loginResponseSchema)
        .then(() => {
          router.replace("/admin/commandas");
          router.refresh();
        })
        .catch((caughtError: unknown) => {
          setError(caughtError instanceof Error ? caughtError.message : "Falha ao entrar.");
        });
    });
  }

  return (
    <form
      className="login-card"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(new FormData(event.currentTarget));
      }}
    >
      <p className="eyebrow">Adega Dela's Vibe</p>
      <h1>PDV com foco em operação</h1>
      <p className="muted">
        Faça login para abrir comandas, registrar pagamentos e manter o estoque sincronizado.
      </p>

      <label className="field">
        <span>Usuário</span>
        <input name="username" type="text" placeholder="admin" autoComplete="username" required />
      </label>

      <label className="field">
        <span>Senha</span>
        <input name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button button-primary" type="submit" disabled={isPending}>
        {isPending ? "Entrando..." : "Entrar no PDV"}
      </button>
    </form>
  );
}

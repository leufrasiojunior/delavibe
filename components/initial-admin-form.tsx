"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { apiFetch } from "@/lib/api/client";
import { loginResponseSchema } from "@/lib/schemas/auth";

export function InitialAdminForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);

    const payload = {
      name: String(formData.get("name") || ""),
      username: String(formData.get("username") || ""),
      password: String(formData.get("password") || ""),
      confirmPassword: String(formData.get("confirmPassword") || ""),
    };

    startTransition(() => {
      void apiFetch(
        "/api/setup/initial-admin",
        { method: "POST", body: JSON.stringify(payload) },
        loginResponseSchema,
      )
        .then(() => {
          router.replace("/admin/commandas");
          router.refresh();
        })
        .catch((caughtError: unknown) => {
          setError(
            caughtError instanceof Error ? caughtError.message : "Falha ao criar o administrador inicial.",
          );
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
      <p className="eyebrow">Configuração inicial</p>
      <h1>Criar administrador</h1>
      <p className="muted">
        Esse passo fica disponível apenas no primeiro acesso. Depois disso, o login passa a exigir a conta criada
        aqui.
      </p>

      <label className="field">
        <span>Nome</span>
        <input name="name" type="text" placeholder="Administrador" autoComplete="name" required />
      </label>

      <label className="field">
        <span>Usuário ou e-mail</span>
        <input name="username" type="text" placeholder="admin@empresa.local" autoComplete="username" required />
      </label>

      <label className="field">
        <span>Senha</span>
        <input name="password" type="password" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" required />
      </label>

      <label className="field">
        <span>Confirmar senha</span>
        <input
          name="confirmPassword"
          type="password"
          placeholder="Repita a senha"
          autoComplete="new-password"
          required
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button button-primary" type="submit" disabled={isPending}>
        {isPending ? "Criando..." : "Criar administrador"}
      </button>
    </form>
  );
}

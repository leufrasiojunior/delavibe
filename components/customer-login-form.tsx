"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { apiFetch } from "@/lib/api/client";
import { customerPublicSchema } from "@/lib/schemas/customer";

type CustomerLoginFormProps = {
  returnUrl: string;
};

export function CustomerLoginForm({ returnUrl }: CustomerLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(() => {
      void apiFetch(
        "/api/customer/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
        customerPublicSchema,
      )
        .then(() => {
          router.replace(returnUrl);
          router.refresh();
        })
        .catch((caught: unknown) => {
          setError(caught instanceof Error ? caught.message : "Falha ao entrar.");
        });
    });
  }

  return (
    <form className="public-article" onSubmit={handleSubmit}>
      <header>
        <p className="eyebrow">Entrar</p>
        <h1>Acesse sua conta</h1>
        <p className="muted">Use o e-mail e senha cadastrados.</p>
      </header>

      <label className="field">
        <span>E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label className="field">
        <span>Senha</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error ? <p className="form-error compact">{error}</p> : null}

      <button type="submit" className="button button-primary" disabled={isPending}>
        {isPending ? "Entrando..." : "Entrar"}
      </button>

      <p className="muted">
        Ainda não tem conta? <Link href="/criar-conta">Criar conta</Link>
      </p>
    </form>
  );
}

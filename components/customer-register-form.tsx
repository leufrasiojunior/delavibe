"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { apiFetch } from "@/lib/api/client";
import { customerPublicSchema } from "@/lib/schemas/customer";

const POLICY_VERSION = "1.0-2026-05";

type CustomerRegisterFormProps = {
  returnUrl: string;
};

export function CustomerRegisterForm({ returnUrl }: CustomerRegisterFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consentData, setConsentData] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!consentData) {
      setError("É necessário aceitar a Política de Privacidade.");
      return;
    }

    if (password !== confirmPassword) {
      setError("A confirmação de senha não confere.");
      return;
    }

    startTransition(() => {
      void apiFetch(
        "/api/customer/register",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            email,
            phone,
            password,
            consentDataProcessing: true,
            consentMarketing,
            policyVersion: POLICY_VERSION,
          }),
        },
        customerPublicSchema,
      )
        .then(() => {
          router.replace(returnUrl);
          router.refresh();
        })
        .catch((caught: unknown) => {
          setError(caught instanceof Error ? caught.message : "Falha ao criar conta.");
        });
    });
  }

  return (
    <form className="public-article" onSubmit={handleSubmit}>
      <header>
        <p className="eyebrow">Criar conta</p>
        <h1>Crie sua conta</h1>
        <p className="muted">
          Tenha pedidos mais rápidos e acesso ao seu histórico.
        </p>
      </header>

      <div className="field-grid">
        <label className="field">
          <span>Nome completo</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
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
          <span>Telefone</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(11) 91234-5678"
            required
          />
        </label>
        <label className="field">
          <span>Senha (8+ chars com letra e número)</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="field">
          <span>Confirmar senha</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
      </div>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={consentData}
          onChange={(event) => setConsentData(event.target.checked)}
        />
        <span>
          Aceito a{" "}
          <Link href="/politica-de-privacidade" target="_blank">
            Política de Privacidade
          </Link>{" "}
          e o processamento dos meus dados.
        </span>
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={consentMarketing}
          onChange={(event) => setConsentMarketing(event.target.checked)}
        />
        <span>Quero receber promoções (opcional).</span>
      </label>

      {error ? <p className="form-error compact">{error}</p> : null}

      <button type="submit" className="button button-primary" disabled={isPending}>
        {isPending ? "Criando..." : "Criar conta"}
      </button>

      <p className="muted">
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { LogIn, LogOut, ShoppingCart, UserPlus } from "lucide-react";

import { apiFetch } from "@/lib/api/client";
import { useCart } from "@/lib/hooks/use-cart";
import { z } from "zod";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "Dela's Vibe";
const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE || "";

const logoutResponseSchema = z.object({ ok: z.literal(true) });

type PublicCustomer = {
  id: string;
  name: string;
  email: string;
};

type PublicShellProps = {
  customer: PublicCustomer | null;
  children: ReactNode;
};

export function PublicShell({ customer, children }: PublicShellProps) {
  const router = useRouter();
  const { count, isHydrated } = useCart();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleLogout() {
    setError(null);
    startTransition(() => {
      void apiFetch("/api/customer/logout", { method: "POST" }, logoutResponseSchema)
        .then(() => {
          router.refresh();
        })
        .catch((caughtError: unknown) => {
          setError(caughtError instanceof Error ? caughtError.message : "Falha ao sair.");
        });
    });
  }

  const cartBadgeCount = isHydrated ? count : 0;

  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="public-header-inner">
          <Link href="/" className="public-header-brand">
            <strong>{storeName}</strong>
            <span>cardápio online</span>
          </Link>

          <nav className="public-header-actions">
            <Link href="/carrinho" className="public-cart-link" aria-label="Abrir carrinho">
              <ShoppingCart size={16} aria-hidden />
              <span>Carrinho</span>
              <span className="public-cart-badge" data-empty={cartBadgeCount === 0}>
                {cartBadgeCount}
              </span>
            </Link>

            {customer ? (
              <div className="public-header-user">
                <span className="muted">Olá, {customer.name.split(" ")[0]}</span>
                <button
                  type="button"
                  className="button button-secondary compact"
                  onClick={handleLogout}
                  disabled={isPending}
                >
                  <LogOut size={14} aria-hidden />
                  {isPending ? "Saindo..." : "Sair"}
                </button>
              </div>
            ) : (
              <div className="public-header-auth">
                <Link href="/entrar" className="button button-secondary compact">
                  <LogIn size={14} aria-hidden />
                  Entrar
                </Link>
                <Link href="/criar-conta" className="button button-primary compact">
                  <UserPlus size={14} aria-hidden />
                  Criar conta
                </Link>
              </div>
            )}
          </nav>
        </div>
        {error ? <p className="form-error compact public-header-error">{error}</p> : null}
      </header>

      <main className="public-content">{children}</main>

      <footer className="public-footer">
        <div className="public-footer-links">
          <Link href="/politica-de-privacidade">Política de privacidade</Link>
          <Link href="/admin/login">Acesso administrativo</Link>
        </div>
        {storePhone ? <div className="muted">Contato: {storePhone}</div> : null}
      </footer>
    </div>
  );
}

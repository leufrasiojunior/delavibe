"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { LogoutButton } from "@/components/logout-button";
import type { AuthSession } from "@/lib/auth/session";

type AppShellProps = {
  session: AuthSession;
  children: ReactNode;
};

const navigation = [
  { href: "/commandas", label: "Comandas" },
  { href: "/pedidos-web", label: "Pedidos web" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Produtos" },
  { href: "/stock", label: "Estoque" },
  { href: "/sales", label: "Vendas" },
];

export function AppShell({ session, children }: AppShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fecha o drawer ao navegar entre rotas
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Bloqueia scroll do body quando o drawer está aberto em mobile
  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  // Fecha com tecla Escape
  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  return (
    <div className={`app-shell ${isMobileMenuOpen ? "menu-open" : ""}`}>
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="app-sidebar"
          aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        >
          <span className="mobile-menu-toggle-icon" aria-hidden>
            {isMobileMenuOpen ? "✕" : "☰"}
          </span>
        </button>
        <strong className="mobile-topbar-title">Dela's Vibe PDV</strong>
      </header>

      {isMobileMenuOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}

      <aside id="app-sidebar" className="sidebar" aria-hidden={!isMobileMenuOpen ? undefined : false}>
        <div className="brand-panel">
          <div className="brand-orbit" />
          <p className="eyebrow">Adega Dela's Vibe</p>
          <h1>Dela's Vibe PDV</h1>
          <p className="muted">
            Balcão rápido, comandas organizadas e estoque auditável em cada venda.
          </p>
        </div>

        <nav className="nav-links">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{session.user.name}</strong>
            <span>{session.user.role === "admin" ? "Administrador" : "Operador"}</span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/logout-button";
import type { AuthSession } from "@/lib/auth/session";

type AppShellProps = {
  session: AuthSession;
  children: ReactNode;
};

const navigation = [
  { href: "/commandas", label: "Comandas" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Produtos" },
  { href: "/stock", label: "Estoque" },
  { href: "/sales", label: "Vendas" },
];

export function AppShell({ session, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
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

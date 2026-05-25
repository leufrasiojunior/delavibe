"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Package,
  ShoppingBag,
} from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import type { AuthSession } from "@/lib/auth/session";

type AppShellProps = {
  session: AuthSession;
  children: ReactNode;
};

type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

const navigation: NavItem[] = [
  { href: "/admin/commandas", label: "Comandas", icon: ClipboardList },
  { href: "/admin/pedidos-web", label: "Pedidos web", icon: ShoppingBag },
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Produtos", icon: Package },
  { href: "/admin/stock", label: "Estoque", icon: Boxes },
  { href: "/admin/sales", label: "Vendas", icon: BarChart3 },
  { href: "/", label: "Ver cardápio público", icon: ExternalLink },
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
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="nav-link">
                <Icon size={18} aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
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

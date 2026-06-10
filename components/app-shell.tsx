"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Package,
  Percent,
  ShoppingBag,
} from "lucide-react";
import type { Role } from "@prisma/client";

import { LogoutButton } from "@/components/logout-button";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
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
  roles?: Role[];
};

const navigation: NavItem[] = [
  { href: "/admin/commandas", label: "Comandas", icon: ClipboardList },
  { href: "/admin/pedidos-web", label: "Pedidos web", icon: ShoppingBag },
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Produtos", icon: Package },
  { href: "/admin/promocoes", label: "Promoções", icon: Percent },
  { href: "/admin/stock", label: "Estoque", icon: Boxes },
  { href: "/admin/sales", label: "Vendas", icon: BarChart3 },
  { href: "/", label: "Ver cardápio público", icon: ExternalLink },
];

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function AppShell({ session, children }: AppShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

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

  // Foco trap + restauração + Escape para fechar
  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    if (sidebar) {
      const first = sidebar.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? sidebar).focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const node = sidebarRef.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === "function") {
        previous.focus();
      }
    };
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

      <aside
        ref={sidebarRef}
        id="app-sidebar"
        className="sidebar"
        aria-hidden={!isMobileMenuOpen ? undefined : false}
        tabIndex={-1}
      >
        <div className="brand-panel">
          <div className="brand-orbit" />
          <p className="eyebrow">Adega Dela's Vibe</p>
          <h1>Dela's Vibe PDV</h1>
          <p className="muted">
            Balcão rápido, comandas organizadas e estoque auditável em cada venda.
          </p>
        </div>

        <nav className="nav-links">
          {navigation
            .filter((item) => !item.roles || item.roles.includes(session.user.role))
            .map((item) => {
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
          <PushNotificationToggle />
          <LogoutButton />
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Network, School, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
const links = [
  { href: "/resumen", label: "Resumen general", icon: LayoutDashboard },
  { href: "/organigrama", label: "Organigrama", icon: Network },
  { href: "/centros", label: "Centros de votación", icon: School },
];
export function Navigation({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="grid grid-cols-3 gap-2 p-3 lg:flex lg:flex-col lg:p-5"
    >
      {[
        ...links,
        ...(admin
          ? [
              {
                href: "/administracion/usuarios",
                label: "Usuarios y accesos",
                icon: Network,
              },
            ]
          : []),
      ].map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-col items-center gap-2 rounded-lg px-2 py-3 text-center text-xs font-medium transition-colors lg:flex-row lg:gap-3 lg:px-4 lg:text-left lg:text-sm",
            pathname === href
              ? "bg-white/12 text-white ring-1 ring-white/15"
              : "text-emerald-100/65 hover:bg-white/5 hover:text-white",
          )}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
          {pathname === href && (
            <ArrowUpRight
              size={15}
              className="ml-auto hidden lg:block"
              aria-hidden="true"
            />
          )}
        </Link>
      ))}
    </nav>
  );
}
export function Breadcrumb() {
  const pathname = usePathname();
  return (
    <div className="text-sm text-muted-foreground">
      <span className="hidden sm:inline">
        Espacio de trabajo <span className="mx-3 text-border">/</span>
      </span>
      <span className="font-medium text-foreground">
        {(pathname === "/administracion/usuarios"
          ? "Usuarios y accesos"
          : links.find((x) => x.href === pathname)?.label) ??
          "Plataforma TBA"}
      </span>
    </div>
  );
}

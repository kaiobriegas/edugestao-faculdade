"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  Layers,
  ShieldCheck,
  Blocks,
  ClipboardList,
  UserRound,
  LogOut,
  BookOpen,
} from "lucide-react";
import { isManager, isRoot, modulePath, type Actor } from "../contracts/access";
import { api, navigateSession } from "./api";
export function Shell({
  actor,
  children,
}: {
  actor: Actor;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const links = [
    { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  ];
  if (isManager(actor))
    links.push({
      href: "/administracao/usuarios",
      label: "Usuários",
      icon: Users,
    });
  if (isRoot(actor))
    links.push(
      { href: "/administracao/grupos", label: "Grupos", icon: Layers },
      { href: "/administracao/papeis", label: "Papéis", icon: ShieldCheck },
      { href: "/administracao/modulos", label: "Módulos", icon: Blocks },
    );
  if (isManager(actor))
    links.push({
      href: "/administracao/eventos",
      label: "Eventos",
      icon: ClipboardList,
    });
  async function logout() {
    setLeaving(true);
    try {
      await api("/api/auth/logout", {});
      navigateSession("/login");
    } catch {
      setError("Não foi possível sair. Tente novamente.");
      setLeaving(false);
    }
  }
  return (
    <>
      <a className="skip-link" href="#conteudo-principal">
        Pular para o conteúdo
      </a>
      <div className="workspace">
        <aside className="sidebar">
          <Link className="brand" href="/dashboard">
            <GraduationCap size={30} />
            <span>
              EduGestão<small>GESTÃO EDUCACIONAL</small>
            </span>
          </Link>
          <nav aria-label="Menu principal">
            <p className="nav-label">PRINCIPAL</p>
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                className={path === href ? "nav-link selected" : "nav-link"}
                aria-current={path === href ? "page" : undefined}
                href={href}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            {!!actor.modulos.length && <p className="nav-label">MÓDULOS</p>}
            {actor.modulos.map((m) => (
              <Link
                key={m.id}
                className={
                  path === modulePath(m.codigo) ||
                  path.startsWith(modulePath(m.codigo) + "/")
                    ? "nav-link selected"
                    : "nav-link"
                }
                aria-current={
                  path === modulePath(m.codigo) ||
                  path.startsWith(modulePath(m.codigo) + "/")
                    ? "page"
                    : undefined
                }
                href={modulePath(m.codigo)}
              >
                <BookOpen size={18} />
                {m.nome.replace("Gestão de ", "")}
              </Link>
            ))}
            <Link
              className={path === "/perfil" ? "nav-link selected" : "nav-link"}
              href="/perfil"
            >
              <UserRound size={18} />
              Meu perfil
            </Link>
          </nav>
          <div className="sidebar-footer">
            <span>Projeto acadêmico</span>
            <small>Banco de Dados · 2026</small>
          </div>
        </aside>
        <div className="main-area">
          <header className="topbar">
            <span className="topbar-title">Plataforma educacional</span>
            <div className="identity">
              <div className="avatar" aria-hidden="true">
                {actor.nome.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <strong>{actor.nome}</strong>
                <small>{actor.papel}</small>
              </div>
              <button
                className="icon-button"
                onClick={logout}
                disabled={leaving}
                aria-label="Sair da conta"
              >
                <LogOut size={19} />
              </button>
            </div>
          </header>
          <main className="content" id="conteudo-principal" tabIndex={-1}>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

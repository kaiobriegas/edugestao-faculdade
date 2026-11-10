import { modulePath } from "@/modules/core/contracts/access";
import Link from "next/link";
import { pageActor } from "@/lib/core-server";
import { getDatabase } from "@/lib/db";
import { dashboardData } from "@/modules/core/repositories/queries";
export default async function Dashboard() {
  const actor = await pageActor();
  const data = await dashboardData(getDatabase(), actor);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">VISÃO GERAL</p>
          <h1>Olá, {actor.nome.split(" ")[0]}.</h1>
          <p>Bem-vindo à sua plataforma de gestão educacional.</p>
        </div>
        <span className="tag">{actor.grupo}</span>
      </div>
      <div className="stats">
        {data.usuarios !== null && (
          <div className="stat">
            <span>
              Usuários ativos
              {actor.papel === "Administrador" ? " no grupo" : ""}
            </span>
            <strong>{data.usuarios}</strong>
            <small>Contas cadastradas no sistema</small>
          </div>
        )}
        {data.grupos !== null && (
          <div className="stat">
            <span>Grupos ativos</span>
            <strong>{data.grupos}</strong>
            <small>Organização do acesso</small>
          </div>
        )}
        <div className="stat">
          <span>
            {actor.papel === "root" ? "Módulos ativos" : "Módulos liberados"}
          </span>
          <strong>{data.modulos}</strong>
          <small>Áreas de gestão educacional</small>
        </div>
        <div className="stat">
          <span>Seu perfil</span>
          <strong className="stat-label">{actor.papel}</strong>
          <small>Permissões verificadas no servidor</small>
        </div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Seus módulos</h2>
            <p>Áreas disponíveis de acordo com seu acesso.</p>
          </div>
        </div>
        {actor.modulos.length ? (
          <div className="module-grid">
            {actor.modulos.map((m, index) => (
              <Link
                className="module-card"
                key={m.id}
                href={modulePath(m.codigo)}
              >
                <span className="module-number">0{index + 1}</span>
                <h3>{m.nome}</h3>
                <p>
                  {m.codigo === "alunos"
                    ? "Alunos, turmas, responsáveis e documentos."
                    : m.codigo === "cursos"
                      ? "Cursos, professores, aulas e matrículas."
                      : m.codigo === "avaliacoes"
                        ? "Provas, questões, correções e resultados."
                        : m.codigo === "biblioteca"
                          ? "Acervo, empréstimos, devoluções e reservas."
                          : "Planos, cobranças, descontos e pagamentos internos."}
                </p>
                <span aria-hidden="true">Abrir área →</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>Nenhum módulo liberado</h3>
            <p>Solicite ao root a habilitação dos módulos para seu grupo.</p>
          </div>
        )}
      </section>
      <div className="note">
        Núcleo e cinco módulos integrados. Use o menu para acessar as áreas
        liberadas para sua conta.
      </div>
    </>
  );
}

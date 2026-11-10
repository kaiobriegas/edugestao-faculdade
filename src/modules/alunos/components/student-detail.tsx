"use client";
import { useCallback, useEffect, useState } from "react";
import { isManager, type Actor } from "@/modules/core/contracts/access";
import { api } from "@/modules/core/components/api";
import type { StudentDetail, StudentOptions } from "../repositories/queries";
import { StudentNav } from "./student-nav";
import { emptyOptions } from "./fields";
import { ResponsibleSection } from "./responsible-section";
import { DocumentSection } from "./document-section";
import { OccurrenceSection } from "./occurrence-section";
export function StudentFile({
  initial,
  actor,
  maxBytes,
}: {
  initial: StudentDetail;
  actor: Actor;
  maxBytes: number;
}) {
  const [detail, setDetail] = useState(initial),
    [options, setOptions] = useState<StudentOptions>(emptyOptions),
    [error, setError] = useState("");
  const manager = isManager(actor);
  const refresh = useCallback(async () => {
    const result = await api<StudentDetail>(
      `/api/alunos/detalhes?id=${initial.aluno.id}`,
    );
    setDetail(result);
    if (manager) setOptions(await api<StudentOptions>("/api/alunos/opcoes"));
  }, [initial.aluno.id, manager]);
  useEffect(() => {
    if (!manager) return;
    let ignore = false;
    api<StudentOptions>("/api/alunos/opcoes")
      .then((data) => {
        if (!ignore) setOptions(data);
      })
      .catch(() => {
        if (!ignore)
          setError("Não foi possível carregar as opções de vínculo.");
      });
    return () => {
      ignore = true;
    };
  }, [manager]);
  const a = detail.aluno;
  const birth = a.dataNascimento
    ? a.dataNascimento.split("-").reverse().join("/")
    : "Não informado";
  return (
    <>
      <StudentNav manage={manager} />
      <div className="page-heading">
        <div>
          <p className="eyebrow">FICHA ACADÊMICA</p>
          <h1>{a.nome}</h1>
          <p>
            Matrícula {a.matricula} · {a.turma}
          </p>
        </div>
        <span className={a.ativo ? "tag green" : "tag"}>
          {a.status}
          {a.ativo ? "" : " · inativo"}
        </span>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <h2>Dados do aluno</h2>
        <dl className="student-data">
          <div>
            <dt>Nascimento</dt>
            <dd>{birth}</dd>
          </div>
          <div>
            <dt>Data de matrícula</dt>
            <dd>{a.dataMatricula.split("-").reverse().join("/")}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{a.email || "Não informado"}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{a.telefone || "Não informado"}</dd>
          </div>
          <div>
            <dt>Endereço</dt>
            <dd>{a.endereco || "Não informado"}</dd>
          </div>
          <div>
            <dt>Conta de acesso</dt>
            <dd>{a.usuarioId ? "Vinculada" : "Sem conta vinculada"}</dd>
          </div>
        </dl>
        {manager && (
          <p className="note">
            Para editar os dados ou transferir de turma, volte à listagem Alunos
            e clique em Editar.
          </p>
        )}
      </section>
      <ResponsibleSection
        detail={detail}
        options={options}
        manage={manager}
        onSaved={refresh}
      />
      <DocumentSection
        detail={detail}
        manage={manager}
        onSaved={refresh}
        maxBytes={maxBytes}
      />
      {manager && <OccurrenceSection detail={detail} onSaved={refresh} />}
      <section className="panel">
        <h2>Histórico acadêmico</h2>
        <p className="section-description">
          Cadastro criado em{" "}
          {new Date(detail.historico.criadoEm).toLocaleDateString("pt-BR")}.
          Última atualização em{" "}
          {new Date(detail.historico.atualizadoEm).toLocaleDateString("pt-BR")}.
        </p>
        <h3 className="history-heading">Cursos · últimos 20 registros</h3>
        {!detail.historico.cursosPermitidos ? (
          <p>Gestão de Cursos não está habilitada para seu acesso.</p>
        ) : !detail.historico.matriculas.length ? (
          <p>Nenhuma matrícula em curso registrada.</p>
        ) : (
          <ul className="history-list">
            {detail.historico.matriculas.map((m) => (
              <li key={m.id}>
                {m.curso} · {m.status} · {m.data.split("-").reverse().join("/")}
              </li>
            ))}
          </ul>
        )}
        <h3 className="history-heading">Avaliações · últimas 20 notas</h3>
        {!detail.historico.avaliacoesPermitidas ? (
          <p>Gestão de Avaliações não está habilitada para seu acesso.</p>
        ) : !detail.historico.notas.length ? (
          <p>Nenhuma nota registrada.</p>
        ) : (
          <ul className="history-list">
            {detail.historico.notas.map((n) => (
              <li key={n.id}>
                {n.avaliacao} · Nota {n.valor}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

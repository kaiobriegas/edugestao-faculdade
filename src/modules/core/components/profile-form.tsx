"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Actor } from "../contracts/access";
import { api, navigateSession } from "./api";
export function ProfileForm({ actor }: { actor: Actor }) {
  const [nome, setNome] = useState(actor.nome);
  const [email, setEmail] = useState(actor.email);
  const [novaSenha, setNovaSenha] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ relogin: boolean }>("/api/core/perfil", {
        nome,
        email,
        novaSenha: novaSenha || undefined,
        confirmacaoSenha: senha,
      });
      if (result.relogin) {
        navigateSession("/login");
        return;
      }
      setSenha("");
      setNotice("Perfil atualizado.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MINHA CONTA</p>
          <h1>Meu perfil</h1>
          <p>Atualize seus dados e mantenha sua senha segura.</p>
        </div>
        <span className="tag">
          {actor.papel} · {actor.grupo}
        </span>
      </div>
      <section className="panel profile-panel">
        <h2>Dados de acesso</h2>
        <form className="stack" onSubmit={submit}>
          <label className="field">
            Nome
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label className="field">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
          </label>
          <label className="field">
            Nova senha (opcional)
            <input
              type="password"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              minLength={10}
              maxLength={128}
            />
          </label>
          <label className="field">
            Sua senha atual
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              maxLength={128}
            />
          </label>
          <p className="note">
            Alterar e-mail ou senha encerra suas sessões. Será necessário entrar
            novamente.
          </p>
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="alert success" role="status">
              {notice}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar perfil"}
          </button>
        </form>
      </section>
    </>
  );
}

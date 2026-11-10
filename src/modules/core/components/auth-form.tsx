"use client";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { GraduationCap, ArrowRight } from "lucide-react";
import { api, navigateSession } from "./api";
export function AuthForm({
  mode,
  token = "",
}: {
  mode: "login" | "recuperar" | "redefinir";
  token?: string;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<{ email: string; senha: string }>({ shouldUnregister: true });
  const titles = {
    login: "Entre na sua conta",
    recuperar: "Recupere seu acesso",
    redefinir: "Escolha uma nova senha",
  };
  const labels = {
    login: "Entrar",
    recuperar: "Enviar link de recuperação",
    redefinir: "Salvar nova senha",
  };
  async function submit(data: { email: string; senha: string }) {
    setError("");
    setMessage("");
    try {
      const body =
        mode === "login"
          ? { email: data.email, senha: data.senha }
          : mode === "recuperar"
            ? { email: data.email }
            : { token, senha: data.senha };
      const result = await api<{ message?: string }>(`/api/auth/${mode}`, body);
      if (mode === "login") {
        navigateSession("/dashboard");
        return;
      }
      setMessage(result.message || "Operação concluída.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente novamente.");
    }
  }
  return (
    <main className="auth-wrap">
      <div className="auth-story">
        <div className="brand">
          <GraduationCap size={30} />
          <span>
            EduGestão<small>PLATAFORMA EDUCACIONAL</small>
          </span>
        </div>
        <div>
          <span className="eyebrow light">GESTÃO ACADÊMICA</span>
          <h1>
            Organização para
            <br />
            quem ensina
            <br />e aprende.
          </h1>
          <p>
            Cursos, alunos, avaliações, biblioteca e financeiro em um só lugar.
          </p>
        </div>
        <small>Projeto acadêmico · Banco de Dados · 2026</small>
      </div>
      <section className="auth-card">
        <div className="auth-content">
          <p className="eyebrow">BEM-VINDO</p>
          <h2>{titles[mode]}</h2>
          <p>
            {mode === "login"
              ? "Use o e-mail e a senha do seu cadastro."
              : mode === "recuperar"
                ? "Enviaremos um link válido por 30 minutos."
                : "Use pelo menos 10 caracteres."}
          </p>
          <form onSubmit={handleSubmit(submit)} className="stack">
            {mode !== "redefinir" && (
              <label className="field">
                E-mail
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="voce@instituicao.edu.br"
                  {...register("email", { required: "Informe seu e-mail." })}
                  required
                  maxLength={254}
                />
                {errors.email && (
                  <small className="error-text">{errors.email.message}</small>
                )}
              </label>
            )}
            {mode !== "recuperar" && (
              <label className="field">
                {mode === "login" ? "Senha" : "Nova senha"}
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  {...register("senha", {
                    required: "Informe a senha.",
                    minLength:
                      mode === "redefinir"
                        ? { value: 10, message: "Use 10 caracteres ou mais." }
                        : undefined,
                  })}
                  required
                  minLength={mode === "redefinir" ? 10 : 1}
                  maxLength={128}
                />
              </label>
            )}
            {mode === "login" && (
              <Link className="auth-recover" href="/recuperar-senha">
                Esqueci minha senha
              </Link>
            )}
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="alert success" role="status">
                {message}
              </p>
            )}
            <button
              className="btn primary wide"
              disabled={isSubmitting || (mode === "redefinir" && !token)}
            >
              {isSubmitting ? "Aguarde…" : labels[mode]}
              <ArrowRight size={16} />
            </button>
            {mode === "redefinir" && !token && (
              <p role="alert" className="error-text">
                Abra o link de recuperação recebido no seu e-mail.
              </p>
            )}
          </form>
          {mode !== "login" && (
            <Link className="text-link" href="/login">
              ← Voltar para o login
            </Link>
          )}
          {mode === "login" && (
            <p className="first-access">
              Primeiro acesso? O responsável deve executar{" "}
              <code>npm run bootstrap:root</code> no terminal do projeto.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

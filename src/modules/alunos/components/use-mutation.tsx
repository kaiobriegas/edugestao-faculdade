"use client";
import { useState } from "react";
import { api, navigateSession } from "@/modules/core/components/api";
export function useStudentMutation(onSaved: () => Promise<void>) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run(
    resource: string,
    body: unknown,
    message = "Alteração salva.",
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (body instanceof FormData) {
        const response = await fetch(`/api/alunos/${resource}`, {
          method: "POST",
          body,
        });
        const result = await response.json();
        if (response.status === 401) navigateSession("/login");
        if (!response.ok)
          throw new Error(result.error || "Não foi possível enviar.");
      } else await api(`/api/alunos/${resource}`, body);
      await onSaved();
      setMessage(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const feedback = (
    <>
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
    </>
  );
  return { busy, run, feedback };
}

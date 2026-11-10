"use client";
import { useEffect, useId, useRef } from "react";
import type { Field } from "./fields";
export type FormValues = Record<string, string>;
export function EntityEditor({
  fields,
  values,
  change,
  submit,
  close,
  saving,
  editing,
}: {
  fields: Field[];
  values: FormValues;
  change: (name: string, value: string) => void;
  submit: (e: React.FormEvent) => void;
  close: () => void;
  saving: boolean;
  editing: boolean;
}) {
  const headingId = useId(),
    section = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    section.current
      ?.querySelector<HTMLElement>(
        "input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
      )
      ?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <section className="panel" ref={section} aria-labelledby={headingId}>
      <div className="section-heading">
        <h2 id={headingId}>{editing ? "Editar cadastro" : "Novo cadastro"}</h2>
        <button className="btn small" type="button" onClick={close}>
          Fechar
        </button>
      </div>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          {fields.map((f) => (
            <label className="field" key={f.name}>
              {f.label}
              {f.type === "textarea" ? (
                <textarea
                  rows={3}
                  disabled={f.disabled}
                  required={f.required}
                  value={values[f.name] || ""}
                  onChange={(e) => change(f.name, e.target.value)}
                  maxLength={f.maxLength}
                />
              ) : f.type === "select" ? (
                <select
                  aria-label={f.label}
                  value={values[f.name] || ""}
                  onChange={(e) => change(f.name, e.target.value)}
                  required={f.required}
                  disabled={f.disabled}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type || "text"}
                  value={values[f.name] || ""}
                  onChange={(e) => change(f.name, e.target.value)}
                  required={f.required}
                  disabled={f.disabled}
                  min={f.min}
                  step={f.step}
                  max={f.max}
                  maxLength={f.maxLength}
                  autoComplete={
                    f.type === "password" ? "current-password" : undefined
                  }
                />
              )}
            </label>
          ))}
        </div>
        <div className="actions">
          <button className="btn primary" disabled={saving}>
            {saving ? "Salvando…" : "Salvar cadastro"}
          </button>
          <button className="btn" type="button" onClick={close}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

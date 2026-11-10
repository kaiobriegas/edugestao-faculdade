export type Actor = {
  id: number;
  nome: string;
  email: string;
  papel: string;
  grupoId: number;
  grupo: string;
  modulos: { id: number; codigo: string; nome: string }[];
};
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const isRoot = (actor: Actor) => actor.papel === "root";
export const isManager = (actor: Actor) =>
  ["root", "Administrador"].includes(actor.papel);
export function assertRoot(actor: Actor) {
  if (!isRoot(actor)) throw new AppError("Acesso restrito ao root.", 403);
}
export function assertManager(actor: Actor) {
  if (!isManager(actor))
    throw new AppError("Acesso administrativo necessário.", 403);
}
export function assertModule(actor: Actor, code: string) {
  if (!actor.modulos.some((m) => m.codigo === code))
    throw new AppError("Módulo não habilitado para seu grupo.", 403);
}
export function canManageUser(
  actor: Actor,
  target: { grupoId: number; papel: string },
) {
  return (
    isRoot(actor) ||
    (actor.papel === "Administrador" &&
      target.grupoId === actor.grupoId &&
      target.papel === "Usuário")
  );
}

export function modulePath(code: string) {
  return [
    "alunos",
    "cursos",
    "avaliacoes",
    "biblioteca",
    "financeiro",
  ].includes(code)
    ? `/${code}`
    : `/modulos/${code}`;
}

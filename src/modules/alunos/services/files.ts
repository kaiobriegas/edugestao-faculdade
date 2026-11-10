import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, relative, sep, join } from "node:path";
import type { DatabaseClient } from "@/lib/database-client";
import { AppError, isManager } from "@/modules/core/contracts/access";
import { audit } from "@/modules/core/services/auth";
import { uploadSchema } from "../schemas/alunos";
import { assertStudentRecord, freshStudentActor, lockStudents } from "./access";
export function inspectFile(
  name: string,
  mime: string,
  bytes: Uint8Array,
  limit: number,
) {
  if (!bytes.length || bytes.length > limit)
    throw new AppError("Arquivo vazio ou maior que o limite permitido.", 413);
  const lower = name.toLowerCase();
  let ext = "";
  if (
    mime === "application/pdf" &&
    lower.endsWith(".pdf") &&
    Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-"
  )
    ext = "pdf";
  if (
    mime === "image/png" &&
    lower.endsWith(".png") &&
    Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    ext = "png";
  if (
    mime === "image/jpeg" &&
    /\.jpe?g$/.test(lower) &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    ext = "jpg";
  if (!ext)
    throw new AppError(
      "Envie PDF, PNG ou JPEG válido, com nome e tipo correspondentes.",
    );
  const cleanName =
    name
      .normalize("NFKC")
      .replace(/[\x00-\x1f\x7f/\\]/g, "_")
      .slice(0, 160) || "documento." + ext;
  return { ext, cleanName };
}
export function documentStorage(base: string) {
  const root = resolve(base, "documentos");
  const publicDir = resolve("public");
  const rel = relative(publicDir, root);
  if (
    rel === "" ||
    (!rel.startsWith(".." + sep) && rel !== ".." && !rel.includes(":"))
  )
    throw new AppError("Configure armazenamento privado fora da pasta public.");
  function path(key: string) {
    if (!/^[a-f0-9-]{36}\.(pdf|png|jpg)$/.test(key))
      throw new AppError("Chave de arquivo inválida.");
    return join(root, key);
  }
  return {
    async put(key: string, bytes: Uint8Array) {
      const target = path(key);
      await mkdir(root, { recursive: true });
      await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
    },
    async get(key: string) {
      try {
        return await readFile(path(key));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT")
          throw new AppError("Arquivo não encontrado.", 404);
        throw e;
      }
    },
    async remove(key: string) {
      try {
        await unlink(path(key));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    },
  };
}
export function createDocumentService(
  db: DatabaseClient,
  storage: ReturnType<typeof documentStorage>,
  maxBytes: number,
) {
  async function upload(
    actorId: number,
    input: unknown,
    file: { name: string; type: string; bytes: Uint8Array },
  ) {
    await freshStudentActor(db, actorId, true);
    const data = uploadSchema.parse(input);
    const actor = await freshStudentActor(db, actorId, true);
    await assertStudentRecord(db, actor, data.alunoId);
    const checked = inspectFile(file.name, file.type, file.bytes, maxBytes);
    const key = randomUUID() + "." + checked.ext;
    await storage.put(key, file.bytes);
    try {
      return await db.$transaction(async (tx) => {
        await lockStudents(tx);
        const current = await freshStudentActor(tx, actorId, true);
        await assertStudentRecord(tx, current, data.alunoId);
        const doc = await tx.documento.create({
          data: {
            alunoId: data.alunoId,
            tipo: data.tipo,
            descricao: data.descricao,
            nomeArquivo: checked.cleanName,
            chaveArmazenamento: key,
            mimeType: file.type,
            tamanhoBytes: file.bytes.length,
          },
        });
        await audit(
          tx,
          current.id,
          "DOCUMENTO_ENVIADO",
          "Documento",
          doc.idDocumento,
          current.grupoId,
        );
        return { id: doc.idDocumento };
      });
    } catch (error) {
      await storage.remove(key);
      throw error;
    }
  }
  async function download(actorId: number, id: number) {
    const actor = await freshStudentActor(db, actorId);
    const doc = await db.documento.findUnique({ where: { idDocumento: id } });
    if (!doc || (!isManager(actor) && !doc.ativo))
      throw new AppError("Documento não encontrado.", 404);
    await assertStudentRecord(db, actor, doc.alunoId);
    return {
      bytes: await storage.get(doc.chaveArmazenamento),
      name: doc.nomeArquivo,
      mime: doc.mimeType,
    };
  }
  return { upload, download };
}
export async function readMultipart(request: Request, maxBytes: number) {
  const maximum = maxBytes + 65536;
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Envie um arquivo.");
  const parts: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > maximum) {
      await reader.cancel();
      throw new AppError("Arquivo maior que o limite permitido.", 413);
    }
    parts.push(part.value);
  }
  try {
    return await new Response(Buffer.concat(parts), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
  } catch {
    throw new AppError("Envio de arquivo inválido.");
  }
}

import "server-only";
import nodemailer from "nodemailer";
import { readEnvironment } from "./env";
export async function sendRecovery(email: string, token: string) {
  const link = new URL("/redefinir-senha", readEnvironment().APP_URL);
  link.searchParams.set("token", token);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "127.0.0.1",
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 5000,
    socketTimeout: 5000,
  });
  try {
    await transport.sendMail({
      from:
        process.env.MAIL_FROM ||
        "Plataforma Educacional <nao-responda@educacional.local>",
      to: email,
      subject: "Redefinir sua senha — Plataforma Educacional",
      text: `Você solicitou a redefinição de senha. Acesse o link em até 30 minutos:\n${link.toString()}\nSe você não solicitou, ignore este e-mail.`,
    });
  } finally {
    transport.close();
  }
}

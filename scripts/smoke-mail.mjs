import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
const subject = `Verificação local da infraestrutura ${randomUUID()}`;
const transport = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 1025,
  secure: false,
});
try {
  await transport.verify();
  await transport.sendMail({
    from: "infraestrutura@example.test",
    to: "teste@example.test",
    subject,
    text: "Teste capturado exclusivamente pelo Mailpit local; nenhum envio externo.",
  });
  const response = await fetch("http://127.0.0.1:8025/api/v1/messages");
  if (!response.ok) throw new Error("Mailpit indisponível.");
  const data = await response.json();
  if (!data.messages.some((message) => message.Subject === subject))
    throw new Error("Mensagem não encontrada no Mailpit.");
  console.log(
    "SMTP verificado e mensagem capturada pelo Mailpit local. Sem envio externo.",
  );
} finally {
  transport.close();
}

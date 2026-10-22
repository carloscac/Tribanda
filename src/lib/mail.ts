import nodemailer from "nodemailer";

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendMail(opts: { to: string; subject: string; text: string; html: string }) {
  if (!mailConfigured()) {
    throw new Error("SMTP no configurado (SMTP_HOST y SMTP_FROM).");
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

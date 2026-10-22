import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const DEFAULT_CATEGORIES = [
  { name: "Primera", distance: 18, sortOrder: 1 },
  { name: "Segunda", distance: 15, sortOrder: 2 },
  { name: "Tercera", distance: 12, sortOrder: 3 },
];

const prisma = new PrismaClient();

async function main() {
  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount > 0) {
    console.log("Bootstrap admin: ya hay administrador; se omite.");
    return;
  }

  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "");
  const name = String(process.env.BOOTSTRAP_ADMIN_NAME ?? "Administrador").trim();

  if (!email || !password) {
    console.error(
      "ERROR: No hay administrador en la base de datos. Define BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD (mín. 6 caracteres) en el entorno del contenedor.",
    );
    process.exit(1);
  }
  if (!email.includes("@")) {
    console.error("ERROR: BOOTSTRAP_ADMIN_EMAIL no es un email válido.");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("ERROR: BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 6 caracteres.");
    process.exit(1);
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    if (exists.role === "ADMIN") return;
    await prisma.user.update({
      where: { id: exists.id },
      data: { role: "ADMIN", active: true },
    });
    console.log(`Bootstrap admin: cuenta existente promovida a ADMIN (${email}).`);
    return;
  }

  await prisma.user.create({
    data: {
      name: name.length >= 2 ? name : "Administrador",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      categories: {
        create: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      },
    },
  });

  console.log(`Bootstrap admin: administrador creado (${email}). Entra en /entrar con ese email.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

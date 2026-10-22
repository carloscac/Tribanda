import { prisma } from "@/lib/prisma";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomCode() {
  let code = "TB";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export async function allocatePlayerCode() {
  for (let attempt = 0; attempt < 24; attempt++) {
    const code = randomCode();
    const taken = await prisma.player.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  return `TB${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

export async function ensurePlayerCodes() {
  const missing = await prisma.player.findMany({
    where: { OR: [{ code: null }, { code: "" }] },
    select: { id: true },
  });
  for (const row of missing) {
    await prisma.player.update({
      where: { id: row.id },
      data: { code: await allocatePlayerCode() },
    });
  }
  return missing.length;
}

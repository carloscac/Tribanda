import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "PARTICIPANT") {
    return Response.json({ unreadCount: 0, alerts: [] });
  }

  const userId = session.user.id;
  const [unreadCount, alerts] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        kind: true,
      },
    }),
  ]);

  return Response.json({
    unreadCount,
    alerts: alerts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

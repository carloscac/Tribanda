import { CreateOrganizerForm } from "@/components/admin/CreateOrganizerForm";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session-user";
import { parseRole, roleLabel } from "@/lib/roles";
import { EditOrganizerForm } from "@/components/admin/EditOrganizerForm";
import { ResetUserPasswordForm } from "@/components/admin/ResetUserPasswordForm";
import { ToggleUserActiveButton } from "@/components/admin/ToggleUserActiveButton";

export default async function AdminPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      _count: { select: { tournaments: true } },
    },
  });

  const staff = users.filter((u) => u.role === "ADMIN" || u.role === "ORGANIZER");
  const participants = users.filter((u) => u.role === "PARTICIPANT");

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="page-title">Administración</h1>
      <p className="page-lead">
        Crea organizadores (clientes). En la tabla de organizadores usa <strong>Editar</strong> para
        nombre y email, o <strong>Restablecer</strong> para la contraseña.
      </p>

      <div className="mt-8 grid gap-8">
        <CreateOrganizerForm />

        <section className="card overflow-x-auto">
          <h2 className="mb-4 text-lg font-semibold">Organizadores y administradores</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Torneos</th>
                <th>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((user) => (
                <tr key={user.id}>
                  <td className="font-medium">{user.name}</td>
                  <td>{user.email}</td>
                  <td>{roleLabel(parseRole(user.role))}</td>
                  <td className="tabular-nums">{user._count.tournaments}</td>
                  <td>
                    {user.role === "ADMIN" ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <ToggleUserActiveButton id={user.id} active={user.active} />
                    )}
                  </td>
                  <td>
                    {user.role === "ORGANIZER" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <EditOrganizerForm userId={user.id} name={user.name} email={user.email} />
                        <ResetUserPasswordForm userId={user.id} userName={user.name} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Mi cuenta</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {participants.length > 0 ? (
          <details className="card">
            <summary className="cursor-pointer text-lg font-semibold">
              Participantes ({participants.length})
            </summary>
            <p className="mt-2 text-sm text-muted">
              Entran con la cédula. Activa o desactiva la cuenta; no se edita email aquí.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email interno</th>
                    <th>Activo</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((user) => (
                    <tr key={user.id}>
                      <td className="font-medium">{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <ToggleUserActiveButton id={user.id} active={user.active} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}

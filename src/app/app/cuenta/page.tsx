import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { getSessionUser } from "@/lib/session-user";
import { roleLabel } from "@/lib/roles";

export default async function AccountPage() {
  const user = await getSessionUser();

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="page-title">Mi cuenta</h1>
      <p className="page-lead">
        {user ? (
          <>
            {user.name} · {user.email} · {roleLabel(user.role)}
          </>
        ) : (
          "Sesión"
        )}
      </p>
      <div className="mt-8">
        <ChangePasswordForm />
      </div>
    </main>
  );
}

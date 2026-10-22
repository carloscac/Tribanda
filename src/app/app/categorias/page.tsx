import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/CategoryManager";

export default async function CategoriesPage() {
  const session = await auth();
  const categories = await prisma.category.findMany({
    where: { userId: session!.user.id },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <main>
      <h1 className="text-3xl font-semibold">Categorías</h1>
      <p className="mb-6 text-sm text-muted">
        La distancia es a cuántas carambolas juega esa categoría. Ejemplo: Tercera
        12, Segunda 15, Primera 18. En un mixto, cada jugador va a la suya.
      </p>
      <CategoryManager categories={categories} />
    </main>
  );
}

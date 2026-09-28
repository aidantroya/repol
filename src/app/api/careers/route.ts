import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const careers = await prisma.career.findMany({
      include: {
        subjects: {
          include: {
            subject: true,
          },
          orderBy: { semester: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Formatear para que el frontend reciba una lista limpia de materias por carrera
    const formattedCareers = careers.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      slug: c.slug,
      faculty: c.faculty,
      description: c.description,
      icon: c.icon,
      subjects: c.subjects.map((cs) => ({
        id: cs.subject.id,
        name: cs.subject.name,
        code: cs.subject.code,
        slug: cs.subject.slug,
        semester: cs.semester,
      })),
    }));

    return NextResponse.json({ careers: formattedCareers });
  } catch (error) {
    console.error("Error fetching careers:", error);
    return NextResponse.json({ error: "Error al obtener carreras" }, { status: 500 });
  }
}

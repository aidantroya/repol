import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const careerSlug = searchParams.get("career");
    const subjectSlug = searchParams.get("subject");
    const category = searchParams.get("category");
    const subcategory = searchParams.get("subcategory");
    const search = searchParams.get("q");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // Si se filtra por carrera, traer documentos cuyas materias pertenezcan a esa carrera (materias directas o compartidas)
    if (careerSlug) {
      where.subject = {
        careers: {
          some: {
            career: { slug: careerSlug },
          },
        },
      };
    }

    if (subjectSlug) {
      where.subject = {
        ...(where.subject || {}),
        slug: subjectSlug,
      };
    }

    if (category) {
      where.category = category;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { customDescription: { contains: search, mode: "insensitive" } },
        { subject: { name: { contains: search, mode: "insensitive" } } },
        { subject: { code: { contains: search, mode: "insensitive" } } },
      ];
    }

    const session = await getServerSession(authOptions);
    const isAdminOrMod = session?.user?.role === "ADMIN" || session?.user?.role === "MODERATOR";

    const documents = await prisma.document.findMany({
      where,
      include: {
        subject: {
          include: {
            careers: {
              include: { career: true },
            },
          },
        },
        uploadedBy: {
          select: { name: true, image: true, approvedContributions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const sanitizedDocs = documents.map((doc) => {
      if (!isAdminOrMod) {
        return {
          ...doc,
          uploadedBy: {
            name: "Aporte Comunitario",
            image: null,
            approvedContributions: undefined,
          },
        };
      }
      return doc;
    });

    return NextResponse.json({ documents: sanitizedDocs });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: "Error al buscar documentos" }, { status: 500 });
  }
}

// Incrementar contador de descargas
export async function PATCH(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const doc = await prisma.document.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
      select: { downloadCount: true },
    });

    return NextResponse.json({ success: true, downloadCount: doc.downloadCount });
  } catch (error) {
    console.error("Error incrementing downloads:", error);
    return NextResponse.json({ error: "Error al registrar descarga" }, { status: 500 });
  }
}

// Eliminar documento oficial del repositorio (Exclusivo para ADMIN)
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acceso denegado: Solo el Administrador principal puede eliminar documentos del repositorio." },
        { status: 403 }
      );
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID del documento requerido" }, { status: 400 });
    }

    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Documento eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar documento:", error);
    return NextResponse.json({ error: "Error interno al eliminar documento" }, { status: 500 });
  }
}

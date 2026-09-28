import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Obtener envíos del usuario autenticado
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const submissions = await prisma.submission.findMany({
      where: { userId: session.user.id },
      include: {
        subject: {
          include: {
            careers: {
              include: { career: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error("Error fetching user submissions:", error);
    return NextResponse.json({ error: "Error al obtener solicitudes" }, { status: 500 });
  }
}

// Crear una nueva solicitud de subida
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado. Inicia sesión para proponer documentos." }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      fileHash,
      fileSize,
      mimeType,
      storageKey,
      fileUrl,
      category,
      subcategory,
      customDescription,
      periodYear,
      periodTerm,
      subjectId,
      attachments,
    } = body;

    if (!title || !fileHash || !subjectId || !category || !subcategory) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Doble verificación del hash SHA-256
    const existingDoc = await prisma.document.findUnique({
      where: { fileHash },
    });

    if (existingDoc) {
      return NextResponse.json(
        { error: "Este archivo ya existe en el repositorio público." },
        { status: 409 }
      );
    }

    const submission = await prisma.submission.create({
      data: {
        title,
        description: description || null,
        fileHash,
        fileSize: fileSize || 0,
        mimeType: mimeType || "application/pdf",
        storageKey: storageKey || `doc-${Date.now()}`,
        fileUrl: fileUrl || "#",
        attachments: attachments || null,
        category,
        subcategory,
        customDescription: customDescription || null,
        periodYear: parseInt(periodYear, 10) || new Date().getFullYear(),
        periodTerm: periodTerm || "1T",
        subjectId,
        userId: session.user.id,
        status: "PENDING",
      },
      include: {
        subject: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Documento enviado correctamente a la cola de moderación.",
      submission,
    });
  } catch (error) {
    console.error("Error creating submission:", error);
    return NextResponse.json({ error: "Error al registrar la solicitud" }, { status: 500 });
  }
}

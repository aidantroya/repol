import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { s3Client } from "@/lib/s3-r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "repol-academic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado. Inicia sesión primero." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const key = formData.get("key") as string | null;

    if (!file || !key) {
      return NextResponse.json({ error: "Faltan datos del archivo o clave de almacenamiento" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/pdf",
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error("Error en subida directa a R2 vía backend:", error);
    return NextResponse.json(
      { error: "Error al guardar el archivo en el almacenamiento." },
      { status: 500 }
    );
  }
}

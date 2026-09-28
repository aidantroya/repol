import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "El correo electrónico es obligatorio." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validación estricta del dominio institucional oficial de la ESPOL
    if (!normalizedEmail.endsWith("@espol.edu.ec")) {
      return NextResponse.json(
        {
          error: "Acceso restringido: Debes utilizar tu correo institucional de la ESPOL (@espol.edu.ec).",
        },
        { status: 403 }
      );
    }

    // Generar un código PIN de 6 dígitos numéricos criptográficamente seguro
    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de validez

    // Limpiar tokens anteriores para este correo y guardar el nuevo
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    });

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: otp,
        expires,
      },
    });

    // Enviar el correo electrónico
    const sendResult = await sendOtpEmail({
      to: normalizedEmail,
      otp,
    });

    if (!sendResult.success) {
      console.warn("No se pudo enviar el correo, pero el token fue generado:", sendResult.message);
    }

    return NextResponse.json({
      success: true,
      message: `Hemos enviado un código de verificación a ${normalizedEmail}.`,
      devCode: sendResult.devOtp,
    });
  } catch (error) {
    console.error("Error al procesar solicitud de OTP:", error);
    return NextResponse.json(
      { error: "Ocurrió un error interno al generar el código de acceso." },
      { status: 500 }
    );
  }
}

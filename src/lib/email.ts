import nodemailer from "nodemailer";

interface SendOtpEmailParams {
  to: string;
  otp: string;
}

export async function sendOtpEmail({ to, otp }: SendOtpEmailParams): Promise<{ success: boolean; message?: string; devOtp?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || process.env.RESEND_FROM || "RePol ESPOL <onboarding@resend.dev>";

  const subject = `Código de verificación RePol: ${otp}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Código de Verificación ESPOL</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px;">
        <div style="max-width: 480px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; text-align: center;">
          <div style="display: inline-block; background-color: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #93c5fd; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 20px;">
            🎓 Repositorio Académico ESPOL
          </div>
          <h1 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 8px 0;">Tu Código de Verificación</h1>
          <p style="font-size: 14px; color: #a1a1aa; line-height: 1.5; margin: 0 0 24px 0;">
            Ingresa este código de seguridad de 6 dígitos para acceder a <strong>RePol</strong> con tu cuenta institucional.
          </p>
          
          <div style="background-color: #09090b; border: 2px dashed #3b82f6; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #60a5fa; font-family: monospace;">
              ${otp}
            </span>
          </div>

          <p style="font-size: 12px; color: #71717a; margin: 0 0 8px 0;">
            ⏳ Este código expira en <strong>10 minutos</strong>.
          </p>
          <p style="font-size: 12px; color: #71717a; margin: 0;">
            Si tú no solicitaste este código, puedes ignorar este mensaje de forma segura.
          </p>

          <div style="font-size: 11px; color: #52525b; border-top: 1px solid #27272a; padding-top: 16px; margin-top: 24px;">
            © ${new Date().getFullYear()} RePol • Escuela Superior Politécnica del Litoral
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. MÉTODO RECOMENDADO: Resend API (HTTP REST, 100% compatible con Vercel Serverless y entrega garantizada a Outlook/ESPOL)
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject: subject,
          html: htmlContent,
          text: `Tu código de verificación de RePol es: ${otp}. Válido por 10 minutos.`,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        console.error("Resend API error:", resData);
        return { success: false, message: resData.message || "Error en el servicio de correo Resend" };
      }

      console.log(`[RePol] Correo enviado exitosamente vía Resend a ${to} (ID: ${resData.id})`);
      return { success: true };
    } catch (error) {
      console.error("Error conectando con Resend API:", error);
    }
  }

  // 2. MÉTODO SMTP (Nodemailer: Gmail, Brevo, SendGrid, etc.)
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        text: `Tu código de verificación de RePol es: ${otp}. Es válido durante 10 minutos.`,
        html: htmlContent,
      });

      console.log(`[RePol] Correo enviado exitosamente vía SMTP a ${to}`);
      return { success: true };
    } catch (error) {
      console.error("Error al enviar correo vía SMTP:", error);
      return { success: false, message: "Error al conectar con el servidor SMTP" };
    }
  }

  // 3. MODO DESARROLLO / PRUEBAS LOCALES (Si aún no se configuran variables de correo en .env)
  console.log(`\n======================================================`);
  console.log(`[RePol OTP] Correo institucional: ${to}`);
  console.log(`[RePol OTP] Código de verificación: ${otp}`);
  console.log(`======================================================\n`);

  return { success: true, devOtp: otp };
}

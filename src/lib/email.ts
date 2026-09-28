import nodemailer from "nodemailer";

interface SendOtpEmailParams {
  to: string;
  otp: string;
}

export async function sendOtpEmail({ to, otp }: SendOtpEmailParams): Promise<{ success: boolean; message?: string }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || '"RePol ESPOL" <no-reply@espol.edu.ec>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px; }
          .container { max-width: 500px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; text-align: center; }
          .badge { display: inline-block; background-color: #1e3a8a; color: #93c5fd; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
          .title { font-size: 24px; font-weight: bold; color: #ffffff; margin-bottom: 8px; }
          .subtitle { font-size: 14px; color: #a1a1aa; margin-bottom: 24px; }
          .otp-box { background-color: #09090b; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #60a5fa; margin-bottom: 24px; }
          .footer { font-size: 12px; color: #71717a; border-top: 1px solid #27272a; padding-top: 16px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">Repositorio Académico ESPOL</div>
          <h1 class="title">Código de Verificación</h1>
          <p class="subtitle">Utiliza este código de seguridad para iniciar sesión en <strong>RePol</strong>. Válido durante 10 minutos.</p>
          <div class="otp-box">${otp}</div>
          <p style="font-size: 13px; color: #a1a1aa;">Si tú no solicitaste este código, puedes ignorar este mensaje.</p>
          <div class="footer">
            © ${new Date().getFullYear()} RePol • Escuela Superior Politécnica del Litoral
          </div>
        </div>
      </body>
    </html>
  `;

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
        subject: `Tu código de acceso a RePol: ${otp}`,
        text: `Tu código de verificación de RePol es: ${otp}. Es válido durante 10 minutos.`,
        html: htmlContent,
      });

      return { success: true };
    } catch (error) {
      console.error("Error al enviar correo vía SMTP:", error);
      return { success: false, message: "Error al enviar el correo vía SMTP" };
    }
  }

  // Si no hay servidor SMTP configurado aún (ej. entorno local o previa configuración de credenciales),
  // registramos el código en logs para facilitar pruebas inmediatas y nunca bloquear al desarrollador.
  console.log(`\n======================================================`);
  console.log(`[RePol OTP] Correo institucional: ${to}`);
  console.log(`[RePol OTP] Código de verificación: ${otp}`);
  console.log(`======================================================\n`);

  return { success: true };
}

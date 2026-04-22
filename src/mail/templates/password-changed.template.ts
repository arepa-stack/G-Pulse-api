export function passwordChangedTemplate(name: string, appName: string): string {
  const date = new Date().toLocaleString('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contraseña actualizada - ${appName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${appName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 24px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Contraseña actualizada</h2>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Hola, <strong>${name}</strong>. Tu contraseña fue cambiada exitosamente el <strong>${date}</strong>.
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Si fuiste tú quien realizó este cambio, no necesitas hacer nada más.
              </p>
              <!-- Alert box -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;">
                    <p style="margin:0;color:#991b1b;font-size:14px;line-height:1.6;">
                      ⚠️ Si <strong>no</strong> realizaste este cambio, contacta al soporte inmediatamente y cambia tu contraseña.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} ${appName}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

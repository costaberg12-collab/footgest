import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Sends an email through the Manus Forge API
 * Returns `true` if successful, `false` if service is unavailable
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.warn("[Email] Forge API not configured");
    return false;
  }

  try {
    const response = await fetch(`${ENV.forgeApiUrl}/email/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Email] Failed to send email (${response.status})${
          detail ? `: ${detail}` : ""
        }`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Email] Error sending email:", error);
    return false;
  }
}

/**
 * Generates an invite email HTML
 */
export function generateInviteEmailHtml(
  playerName: string,
  inviteLink: string,
  groupName: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0279f7; color: white; padding: 20px; border-radius: 5px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; margin: 20px 0; border-radius: 5px; }
          .button { display: inline-block; background-color: #0279f7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Convite para ${groupName}</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${playerName}</strong>,</p>
            <p>Você foi convidado para participar de <strong>${groupName}</strong>!</p>
            <p>Clique no botão abaixo para aceitar o convite e criar sua conta:</p>
            <div style="text-align: center;">
              <a href="${inviteLink}" class="button">Aceitar Convite</a>
            </div>
            <p>Este link expira em 7 dias.</p>
            <p>Se você não esperava este convite, você pode ignorar este email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

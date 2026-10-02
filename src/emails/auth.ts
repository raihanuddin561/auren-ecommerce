/**
 * Plain, brand-neutral transactional templates for authentication mail.
 * Rich React Email templates replace these when the notifications work lands.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function layout(heading: string, intro: string, action: string, url: string, outro: string) {
  const h = escapeHtml(heading);
  const u = escapeHtml(url);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px;background:#f6f2eb;color:#0f0f0f;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;padding:40px;">
      <tr><td>
        <p style="letter-spacing:0.4em;font-size:14px;margin:0 0 32px;">AUREN</p>
        <h1 style="font-size:22px;font-weight:normal;margin:0 0 16px;">${h}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 28px;">${escapeHtml(intro)}</p>
        <p style="margin:0 0 28px;"><a href="${u}" style="display:inline-block;background:#0f0f0f;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:14px;letter-spacing:0.08em;">${escapeHtml(action)}</a></p>
        <p style="font-size:13px;line-height:1.6;color:#555;margin:0 0 8px;">If the button does not work, paste this link into your browser:</p>
        <p style="font-size:12px;word-break:break-all;color:#555;margin:0 0 28px;">${u}</p>
        <p style="font-size:13px;line-height:1.6;color:#555;margin:0;">${escapeHtml(outro)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function verifyEmailMessage(input: { name: string; url: string }): RenderedEmail {
  const first = input.name.split(' ')[0] || 'there';
  const intro = `Welcome, ${first}. Please confirm your email address to finish creating your AUREN account.`;
  const outro =
    'This link expires in one hour. If you did not create an account, you can ignore this email.';
  return {
    subject: 'Confirm your AUREN account',
    text: `${intro}\n\nConfirm your email: ${input.url}\n\n${outro}`,
    html: layout('Confirm your email', intro, 'Confirm email', input.url, outro),
  };
}

export function resetPasswordMessage(input: { name: string; url: string }): RenderedEmail {
  const first = input.name.split(' ')[0] || 'there';
  const intro = `Hello ${first}, we received a request to reset your AUREN password.`;
  const outro =
    'This link expires in one hour. If you did not ask for this, you can ignore this email and your password will stay the same.';
  return {
    subject: 'Reset your AUREN password',
    text: `${intro}\n\nChoose a new password: ${input.url}\n\n${outro}`,
    html: layout('Reset your password', intro, 'Reset password', input.url, outro),
  };
}

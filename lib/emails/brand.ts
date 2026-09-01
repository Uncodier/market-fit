export const EMAIL_BRAND = {
  black: '#000000',
  white: '#ffffff',
  headerBg: '#1e1e2d',
  headerText: '#f0f0f5',
  headerMuted: '#a1a1aa',
  bodyBg: '#f8fafc',
  cardBg: '#ffffff',
  text: '#111111',
  muted: '#52525b',
  panelBg: '#f0f0f5',
  panelBorder: '#e4e4e7',
  badgeBg: '#90ff17',
  badgeText: '#000000',
} as const;

export const EMAIL_BRAND_STYLE = `
    :root { color-scheme: light only; }

    .email-header {
      background-color: #1e1e2d !important;
      background-image: linear-gradient(#1e1e2d, #1e1e2d) !important;
    }
    .email-header-title,
    .email-header h1 {
      color: #f0f0f5 !important;
      -webkit-text-fill-color: #f0f0f5 !important;
    }
    .email-header-sub,
    .email-header p {
      color: #a1a1aa !important;
      -webkit-text-fill-color: #a1a1aa !important;
    }

    .email-card {
      background-color: #ffffff !important;
      background-image: linear-gradient(#ffffff, #ffffff) !important;
      color: #111111 !important;
    }

    .email-heading {
      color: #111111 !important;
      -webkit-text-fill-color: #111111 !important;
    }
    .email-text {
      color: #111111 !important;
      -webkit-text-fill-color: #111111 !important;
    }
    .email-muted {
      color: #52525b !important;
      -webkit-text-fill-color: #52525b !important;
    }

    .email-panel {
      background-color: #f0f0f5 !important;
      background-image: linear-gradient(#f0f0f5, #f0f0f5) !important;
      border: 1px solid #e4e4e7 !important;
      color: #111111 !important;
    }
    .email-panel,
    .email-panel .email-text,
    .email-panel .email-heading,
    .email-panel div,
    .email-panel p,
    .email-panel span:not(.email-badge):not(.email-cta-label),
    .email-panel strong {
      color: #111111 !important;
      -webkit-text-fill-color: #111111 !important;
    }

    .email-badge {
      display: inline-block !important;
      background-color: #90ff17 !important;
      background-image: linear-gradient(#90ff17, #90ff17) !important;
      box-shadow: inset 0 0 0 999px #90ff17 !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      border: 0 !important;
    }

    .email-cta-td {
      background-color: #000000 !important;
      background-image: linear-gradient(#000000, #000000) !important;
      box-shadow: inset 0 0 0 999px #000000 !important;
    }
    .email-cta {
      background-color: #000000 !important;
      background-image: linear-gradient(#000000, #000000) !important;
      box-shadow: inset 0 0 0 999px #000000 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      border: 0 !important;
    }
    .email-cta-label,
    .email-cta span {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
`;

export function emailBrandHeadTags(): string {
  return `
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <style type="text/css">${EMAIL_BRAND_STYLE}</style>`;
}

export function emailBadge(labelHtml: string): string {
  return `<span class="email-badge" style="display:inline-block;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;background-color:${EMAIL_BRAND.badgeBg};background-image:linear-gradient(${EMAIL_BRAND.badgeBg},${EMAIL_BRAND.badgeBg});box-shadow:inset 0 0 0 999px ${EMAIL_BRAND.badgeBg};color:${EMAIL_BRAND.badgeText};-webkit-text-fill-color:${EMAIL_BRAND.badgeText};">${labelHtml}</span>`;
}

export function emailCtaButton(href: string, label: string): string {
  const padding = '14px 28px';
  const fontSize = '16px';
  const borderRadius = '8px';
  const safeHref = escapeHtml(href);

  return `
      <div style="margin:32px 0;text-align:center;">
        <table border="0" cellspacing="0" cellpadding="0" role="presentation" style="margin:0 auto;">
          <tr>
            <td align="center" bgcolor="${EMAIL_BRAND.black}" class="email-cta-td"
                style="border-radius:${borderRadius};background-color:${EMAIL_BRAND.black};background-image:linear-gradient(${EMAIL_BRAND.black},${EMAIL_BRAND.black});">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="17%" stroke="f" fillcolor="${EMAIL_BRAND.black}">
                <w:anchorlock/>
                <center style="color:${EMAIL_BRAND.white};font-family:sans-serif;font-size:${fontSize};font-weight:600;">
                  ${label}
                </center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <a href="${safeHref}" target="_blank" class="email-cta"
                 style="display:inline-block;padding:${padding};font-size:${fontSize};font-weight:600;line-height:1.2;color:${EMAIL_BRAND.white};text-decoration:none;border:0;border-radius:${borderRadius};background-color:${EMAIL_BRAND.black};background-image:linear-gradient(${EMAIL_BRAND.black},${EMAIL_BRAND.black});box-shadow:inset 0 0 0 999px ${EMAIL_BRAND.black};-webkit-text-size-adjust:none;">
                <span class="email-cta-label" style="color:${EMAIL_BRAND.white};font-weight:600;">${label}</span>
              </a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>
      </div>`;
}

export function escapeHtml(text: string): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

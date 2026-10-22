/** Redact before any reporter serializes Playwright's password-bearing API titles. */
export function redactReportText(value: string, env: Record<string, string | undefined> = process.env): string {
  const secrets = Object.entries(env).filter(([name, secret]) =>
    /(?:PASSWORD|SECRET|TOKEN|(?:SERVICE|API)_KEY)$/.test(name) && secret && secret.length >= 4)
    .map(([, secret]) => secret!).sort((a, b) => b.length - a.length);
  return secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), value);
}
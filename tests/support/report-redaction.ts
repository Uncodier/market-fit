/** Redact before any reporter serializes Playwright's password-bearing API titles. */
export function redactReportText(value: string, env: Record<string, string | undefined> = process.env): string {
  const secrets = Object.entries(env).filter(([name, secret]) =>
    /(?:PASSWORD|SECRET|TOKEN|(?:SERVICE|API)_KEY)$/.test(name) && secret && secret.length >= 4)
    .map(([, secret]) => secret!).sort((a, b) => b.length - a.length);
  return secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), value)
    .replace(/([?&](?:token_hash|token|access_token|refresh_token|code|otp|password)=)[^&#\s"<>]+/gi, '$1[REDACTED]');
}

/** Passwords generated in a worker are not present in the reporter process env. */
export function redactApiStepTitle(title: string, category: string): string {
  if (category === 'pw:api' && /^(?:Fill\b|(?:locator|page)\.fill\b)/i.test(title)) return 'Fill [REDACTED]';
  return redactReportText(title);
}
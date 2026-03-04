const fs = require('fs');

let code = fs.readFileSync('app/components/auth/auth-form.tsx', 'utf-8');

// Replace "Name" label
code = code.replace(
  /<FormLabel className="text-sm font-medium text-foreground">Name<\/FormLabel>/g,
  `<FormLabel className="text-sm font-medium text-foreground">{t('auth.name') || 'Name'}</FormLabel>`
);

// Replace "Your name" placeholder
code = code.replace(
  /placeholder="Your name"/g,
  `placeholder={t('auth.namePlaceholder') || 'Your name'}`
);

// Replace "Create a password" placeholder
code = code.replace(
  /placeholder={authMode === 'sign_up' \? "Create a password" : \(t\('auth.passwordPlaceholder'\) \|\| "Enter your password"\)}/g,
  `placeholder={authMode === 'sign_up' ? (t('auth.createPassword') || "Create a password") : (t('auth.passwordPlaceholder') || "Enter your password")}`
);

// Replace "Sending..." and "Send Reset Link"
code = code.replace(
  /{loading \? "Sending\.\.\." : "Send Reset Link"}/g,
  `{loading ? (t('auth.sending') || "Sending...") : (t('auth.sendResetLink') || "Send Reset Link")}`
);

// Replace "Remember your password? "
code = code.replace(
  /Remember your password\? \{" "\}/g,
  `{t('auth.rememberPassword') || 'Remember your password?'} {" "}`
);

// Replace "Please wait..." and "Get Started" in the submit button
code = code.replace(
  /\{loading \n                  \? "Please wait\.\.\."/g,
  `{loading \n                  ? (t('auth.pleaseWait') || "Please wait...")`
);

code = code.replace(
  /\? "Get Started"/g,
  `? (t('auth.getStarted') || "Get Started")`
);

fs.writeFileSync('app/components/auth/auth-form.tsx', code);
console.log("Replaced strings successfully!");

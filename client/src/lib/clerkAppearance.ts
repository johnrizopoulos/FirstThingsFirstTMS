type Theme = "terminal" | "dark" | "light";

// Logo + backdrop asset mapping per theme.
// Note: "terminal" and "dark" intentionally share the same neon-green branding
// assets — both themes have a dark background and the same brand language.
// "light" gets its own dark-green / cream variants. If dark ever needs its own
// distinct grayscale brand mark, add new files and split the maps below.
const logoForTheme: Record<Theme, string> = {
  terminal: "/clerk/logo-terminal.png",
  dark: "/clerk/logo-terminal.png",
  light: "/clerk/logo-light.png",
};

const backdropForTheme: Record<Theme, string> = {
  terminal: "/clerk/backdrop-terminal.jpg",
  dark: "/clerk/backdrop-terminal.jpg",
  light: "/clerk/backdrop-light.jpg",
};

export function backdropUrlFor(theme: Theme): string {
  return backdropForTheme[theme];
}

export function buildClerkAppearance(theme: Theme) {
  const logoUrl = logoForTheme[theme];

  // Color values reference the same CSS custom properties the rest of the app
  // uses (set per-theme by ThemeProvider). This way the modal automatically
  // tracks the design tokens and never drifts from them. The browser
  // re-evaluates these CSS vars when ThemeProvider rewrites them on :root, so
  // colors live-swap on theme change without React having to re-mount Clerk.
  return {
    layout: {
      logoImageUrl: logoUrl,
      logoPlacement: "inside" as const,
      socialButtonsPlacement: "top" as const,
      socialButtonsVariant: "blockButton" as const,
      showOptionalFields: true,
    },
    variables: {
      colorPrimary: "hsl(var(--primary))",
      colorBackground: "hsl(var(--background))",
      colorText: "hsl(var(--foreground))",
      colorTextSecondary: "hsl(var(--muted-foreground))",
      colorInputBackground: "hsl(var(--input))",
      colorInputText: "hsl(var(--foreground))",
      colorDanger: "hsl(var(--destructive))",
      colorNeutral: "hsl(var(--foreground))",
      borderRadius: "0",
      fontFamily: "'IBM Plex Mono', monospace",
      fontFamilyButtons: "'IBM Plex Mono', monospace",
      fontWeight: { normal: "400", medium: "500", bold: "700" },
    },
    elements: {
      rootBox: "ftf-clerk-root font-mono",
      modalBackdrop: "ftf-clerk-backdrop",
      modalContent: "ftf-clerk-modal-content",
      card:
        "ftf-clerk-card !bg-background !text-foreground border-2 !border-primary !rounded-none !shadow-none",
      headerTitle:
        "!font-mono !font-bold !text-primary !tracking-widest uppercase",
      headerSubtitle: "!font-mono !text-foreground/70",
      socialButtonsBlockButton:
        "!rounded-none !border-2 !border-primary !bg-background !text-foreground hover:!bg-primary/10 !font-mono uppercase tracking-wider",
      socialButtonsBlockButtonText: "!font-mono !font-bold",
      socialButtonsProviderIcon: "!filter-none",
      formButtonPrimary:
        "!rounded-none !border-2 !border-primary !bg-primary !text-primary-foreground hover:!bg-primary/80 !font-mono !font-bold uppercase !tracking-widest !shadow-none",
      formFieldInput:
        "!rounded-none !border-2 !border-primary !bg-input !text-foreground !font-mono",
      formFieldLabel:
        "!font-mono !text-primary uppercase !text-xs !tracking-wider",
      formFieldHintText: "!font-mono !text-foreground/60",
      formFieldErrorText: "!font-mono !text-destructive",
      formFieldInputShowPasswordButton: "!text-primary hover:!text-primary/80",
      otpCodeFieldInput:
        "!rounded-none !border-2 !border-primary !bg-input !text-foreground !font-mono",
      footer: "!bg-background",
      footerActionLink:
        "!text-primary hover:!text-primary/80 !font-mono underline",
      footerActionText: "!font-mono !text-foreground/70",
      dividerLine: "!bg-primary/40",
      dividerText:
        "!font-mono !text-foreground/60 uppercase !tracking-wider",
      identityPreview:
        "!rounded-none !border-2 !border-primary !bg-background",
      identityPreviewText: "!font-mono !text-foreground",
      identityPreviewEditButton: "!text-primary hover:!text-primary/80",
      alertText: "!font-mono",
      formResendCodeLink: "!text-primary hover:!text-primary/80 !font-mono",
      userButtonPopoverCard:
        "!rounded-none !border-2 !border-primary !bg-background !shadow-none",
      userButtonPopoverActionButton: "!font-mono !text-foreground",
      userButtonPopoverActionButtonText: "!font-mono",
    },
  };
}

type Theme = "terminal" | "dark" | "light";

interface ThemeColors {
  primary: string;
  primaryFg: string;
  background: string;
  text: string;
  textSecondary: string;
  inputBg: string;
  inputText: string;
  danger: string;
  border: string;
}

const themeColors: Record<Theme, ThemeColors> = {
  terminal: {
    primary: "hsl(120, 100%, 50%)",
    primaryFg: "hsl(0, 0%, 0%)",
    background: "hsl(120, 10%, 5%)",
    text: "hsl(120, 100%, 50%)",
    textSecondary: "hsl(120, 60%, 60%)",
    inputBg: "hsl(120, 50%, 12%)",
    inputText: "hsl(120, 100%, 60%)",
    danger: "hsl(0, 100%, 55%)",
    border: "hsl(120, 60%, 35%)",
  },
  dark: {
    primary: "hsl(0, 0%, 90%)",
    primaryFg: "hsl(0, 0%, 10%)",
    background: "hsl(0, 0%, 10%)",
    text: "hsl(0, 0%, 90%)",
    textSecondary: "hsl(0, 0%, 70%)",
    inputBg: "hsl(0, 0%, 18%)",
    inputText: "hsl(0, 0%, 95%)",
    danger: "hsl(0, 80%, 60%)",
    border: "hsl(0, 0%, 35%)",
  },
  light: {
    primary: "hsl(0, 0%, 0%)",
    primaryFg: "hsl(0, 0%, 100%)",
    background: "hsl(0, 0%, 100%)",
    text: "hsl(0, 0%, 0%)",
    textSecondary: "hsl(0, 0%, 35%)",
    inputBg: "hsl(0, 0%, 96%)",
    inputText: "hsl(0, 0%, 0%)",
    danger: "hsl(0, 75%, 45%)",
    border: "hsl(0, 0%, 70%)",
  },
};

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
  const c = themeColors[theme];
  const logoUrl = logoForTheme[theme];

  return {
    layout: {
      logoImageUrl: logoUrl,
      logoPlacement: "inside" as const,
      socialButtonsPlacement: "top" as const,
      socialButtonsVariant: "blockButton" as const,
      showOptionalFields: true,
    },
    variables: {
      colorPrimary: c.primary,
      colorBackground: c.background,
      colorText: c.text,
      colorTextSecondary: c.textSecondary,
      colorInputBackground: c.inputBg,
      colorInputText: c.inputText,
      colorDanger: c.danger,
      colorNeutral: c.text,
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

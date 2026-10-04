export type OperatorConfig = {
  productName: string;
  operatorLegalName: string | null;
  contactEmail: string | null;
  supportEmail: string | null;
  businessAddress: string | null;
  jurisdiction: string | null;
  effectiveDate: string;
  policyVersion: string;
};

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const operator: OperatorConfig = {
  productName: "STILL",
  operatorLegalName: emptyToNull(process.env.STILL_OPERATOR_LEGAL_NAME),
  contactEmail: emptyToNull(process.env.STILL_CONTACT_EMAIL),
  supportEmail: emptyToNull(process.env.STILL_SUPPORT_EMAIL),
  businessAddress: emptyToNull(process.env.STILL_BUSINESS_ADDRESS),
  jurisdiction: emptyToNull(process.env.STILL_JURISDICTION),
  effectiveDate: "2026-10-04",
  policyVersion: "2026-10-04",
};

export function isOperatorReady(config: OperatorConfig = operator) {
  return Boolean(config.operatorLegalName && config.contactEmail);
}

export function operatorPlaceholder(label: string) {
  return `[${label} REQUIRED]`;
}

export function operatorDisplay(
  value: string | null,
  label: string,
): { ready: boolean; text: string } {
  if (value) return { ready: true, text: value };
  return { ready: false, text: operatorPlaceholder(label) };
}

export function dayPeriod(hour: number) {
  if (hour < 5) return "night" as const;
  if (hour < 12) return "morning" as const;
  if (hour < 17) return "afternoon" as const;
  if (hour < 21) return "evening" as const;
  return "night" as const;
}

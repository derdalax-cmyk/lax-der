import { PoliciesDialog } from "@/components/PoliciesDialog";

/**
 * Inline clickable link that opens the Policies dialog directly on the
 * "Termos e Condições de Uso" section. Use inside acceptance sentences,
 * e.g. "Aceito os <TermsLink /> da DERDALAX".
 */
export function TermsLink({
  label = "Termos e Condições de Uso",
  slug = "termos-condicoes",
  className = "text-gold underline underline-offset-2 hover:text-gold/80",
}: {
  label?: string;
  slug?: string;
  className?: string;
}) {
  return (
    <PoliciesDialog
      initialSlug={slug}
      trigger={
        <button type="button" className={className}>
          {label}
        </button>
      }
    />
  );
}

export function PrivacyLink({
  label = "Política de Privacidade",
  className = "text-gold underline underline-offset-2 hover:text-gold/80",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <PoliciesDialog
      initialSlug="privacidade-dados"
      trigger={
        <button type="button" className={className}>
          {label}
        </button>
      }
    />
  );
}

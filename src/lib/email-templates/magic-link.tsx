import * as React from 'react'
import { BrandLayout } from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <BrandLayout
    preview="O seu link de acesso à Derdalax"
    title="Entrar na sua conta"
    intro="Toque no botão abaixo para entrar na sua conta Derdalax. Este link é pessoal e expira em breve."
    ctaLabel="Entrar agora"
    ctaUrl={confirmationUrl}
    outro="Se não foi você que solicitou este acesso, pode ignorar este email."
  />
)

export default MagicLinkEmail

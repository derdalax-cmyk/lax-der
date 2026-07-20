import * as React from 'react'
import { BrandLayout } from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <BrandLayout
    preview="Foi convidado(a) para a DERDALAX"
    title="Foi convidado(a)"
    intro="Você foi convidado(a) a juntar-se à DERDALAX. Toque no botão abaixo para aceitar o convite e criar a sua conta."
    ctaLabel="Aceitar convite"
    ctaUrl={confirmationUrl}
    outro="Se não estava à espera deste convite, pode ignorar este email em segurança."
  />
)

export default InviteEmail

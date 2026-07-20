import * as React from 'react'
import { BrandLayout } from './_brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <BrandLayout
    preview="Confirme o seu email na DERDALAX"
    title="Confirme o seu email"
    intro={
      <>
        Bem-vindo(a) à DERDALAX. Falta apenas um passo para ativar a sua conta
        {recipient ? ` (${recipient})` : ''}. Toque no botão abaixo para
        confirmar o seu endereço de email.
      </>
    }
    ctaLabel="Confirmar minha conta"
    ctaUrl={confirmationUrl}
    outro="Se não foi você que criou esta conta, pode ignorar este email em segurança."
  />
)

export default SignupEmail

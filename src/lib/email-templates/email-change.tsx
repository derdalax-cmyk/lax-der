import * as React from 'react'
import { BrandLayout } from './_brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <BrandLayout
    preview="Confirme a alteração do seu email na Derdalax"
    title="Confirmar novo email"
    intro={
      <>
        Foi solicitada uma alteração do email da sua conta Derdalax
        {oldEmail ? <> de <strong>{oldEmail}</strong></> : null}
        {newEmail ? <> para <strong>{newEmail}</strong></> : null}. Toque no
        botão abaixo para confirmar esta alteração.
      </>
    }
    ctaLabel="Confirmar alteração"
    ctaUrl={confirmationUrl}
    outro="Se não foi você que pediu esta alteração, proteja a sua conta imediatamente."
  />
)

export default EmailChangeEmail

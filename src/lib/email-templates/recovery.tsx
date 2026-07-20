import * as React from 'react'
import { BrandLayout } from './_brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <BrandLayout
    preview="Redefina a sua senha na DERDALAX"
    title="Redefinir a sua senha"
    intro="Recebemos um pedido para redefinir a senha da sua conta DERDALAX. Toque no botão abaixo para escolher uma nova senha."
    ctaLabel="Redefinir senha"
    ctaUrl={confirmationUrl}
    outro="Se não foi você, pode ignorar este email — a sua senha atual permanece inalterada."
  />
)

export default RecoveryEmail

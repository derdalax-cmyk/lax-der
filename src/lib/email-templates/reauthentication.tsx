import * as React from 'react'
import { Text } from '@react-email/components'
import { BrandLayout, brand } from './_brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandLayout
    preview="O seu código de verificação DERDALAX"
    title="Código de verificação"
    intro="Use o código abaixo para confirmar a sua identidade na DERDALAX."
    extra={<Text style={brand.code}>{token}</Text>}
    outro="Este código expira em breve. Se não foi você que o pediu, pode ignorar este email."
  />
)

export default ReauthenticationEmail

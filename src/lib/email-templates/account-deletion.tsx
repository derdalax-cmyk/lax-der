import * as React from 'react'
import { Text } from '@react-email/components'
import { BrandLayout, brand } from './_brand'

interface AccountDeletionEmailProps {
  token: string
}

export const AccountDeletionEmail = ({ token }: AccountDeletionEmailProps) => (
  <BrandLayout
    preview="Código para apagar a sua conta DERDALAX"
    title="Confirmar a eliminação da conta"
    intro="Recebemos um pedido para apagar permanentemente a sua conta DERDALAX. Use o código abaixo para confirmar. Esta ação não pode ser desfeita."
    extra={<Text style={brand.code}>{token}</Text>}
    outro="O código expira em 10 minutos. Se não foi você que pediu, ignore este email e a sua conta permanece intacta — recomendamos também alterar a sua senha."
  />
)

export default AccountDeletionEmail

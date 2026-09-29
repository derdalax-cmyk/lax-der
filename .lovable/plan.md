# Preço original e desconto

## Implementação
- Adicionar `original_price` opcional e decimal à tabela de produtos, preservando os dados e as permissões atuais.
- Integrar “Preço original (opcional)” no formulário existente de criação e edição; valores vazios ou zero serão guardados como `NULL`.
- Criar uma função central para validar preço promocional e calcular a percentagem arredondada.
- Mostrar preço original riscado e desconto apenas quando o preço original for superior ao preço atual, nos cartões/listagens e no detalhe.
- Manter `base_price` como único preço usado pelo carrinho, checkout e pedidos.

## Detalhes técnicos
- Migração aditiva, sem alteração de RLS ou políticas existentes.
- Atualizar apenas as projeções de produto necessárias para transportar o novo campo.
- Reutilizar os estilos e a estrutura atuais, sem alterações gerais de layout.
- Verificar os quatro casos pedidos, TypeScript e o build da aplicação.

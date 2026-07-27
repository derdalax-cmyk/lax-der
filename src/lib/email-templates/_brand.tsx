import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

const SERIF = "'Playfair Display', 'Times New Roman', Georgia, serif"
const SANS = "'Helvetica Neue', Arial, sans-serif"

export const brand = {
  page: {
    backgroundColor: '#f4f3f0',
    fontFamily: SANS,
    margin: 0,
    padding: '40px 12px',
  } as React.CSSProperties,
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(10, 10, 10, 0.08)',
  } as React.CSSProperties,
  headerBar: {
    backgroundColor: '#0a0a0a',
    padding: '28px 24px',
    textAlign: 'center' as const,
  },
  brandName: {
    fontFamily: SERIF,
    color: '#e4b363',
    fontSize: '28px',
    letterSpacing: '8px',
    fontWeight: 700,
    margin: 0,
  },
  goldStrip: {
    height: '4px',
    background: 'linear-gradient(90deg, #e4b363 0%, #f2d49b 50%, #e4b363 100%)',
  } as React.CSSProperties,
  content: {
    padding: '40px 36px 32px',
    textAlign: 'center' as const,
  },
  h1: {
    fontFamily: SERIF,
    color: '#0a0a0a',
    fontSize: '26px',
    fontWeight: 700,
    margin: '0 0 18px',
    lineHeight: 1.25,
  } as React.CSSProperties,
  paragraph: {
    fontFamily: SANS,
    color: '#6c6c6c',
    fontSize: '15px',
    lineHeight: 1.6,
    margin: '0 0 24px',
  } as React.CSSProperties,
  button: {
    backgroundColor: '#e4b363',
    color: '#0a0a0a',
    fontFamily: SANS,
    fontSize: '15px',
    fontWeight: 700,
    borderRadius: '10px',
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block',
    letterSpacing: '0.3px',
  } as React.CSSProperties,
  altLinkLabel: {
    fontFamily: SANS,
    color: '#9a9a9a',
    fontSize: '12px',
    margin: '28px 0 6px',
  } as React.CSSProperties,
  altLink: {
    fontFamily: SANS,
    color: '#e4b363',
    fontSize: '12px',
    wordBreak: 'break-all' as const,
    textDecoration: 'underline',
  } as React.CSSProperties,
  code: {
    fontFamily: "'Courier New', monospace",
    fontSize: '30px',
    fontWeight: 700,
    color: '#0a0a0a',
    letterSpacing: '10px',
    backgroundColor: '#faf9f6',
    borderRadius: '10px',
    padding: '18px 24px',
    display: 'inline-block',
    margin: '8px 0 24px',
  } as React.CSSProperties,
  footer: {
    backgroundColor: '#faf9f6',
    padding: '24px',
    textAlign: 'center' as const,
    borderTop: '1px solid #efece5',
  },
  footerBrand: {
    fontFamily: SERIF,
    color: '#0a0a0a',
    fontSize: '16px',
    letterSpacing: '4px',
    margin: '0 0 6px',
  } as React.CSSProperties,
  footerTagline: {
    fontFamily: SANS,
    color: '#8a8a8a',
    fontSize: '12px',
    margin: 0,
  } as React.CSSProperties,
}

interface BrandLayoutProps {
  preview: string
  title: string
  intro: React.ReactNode
  ctaLabel?: string
  ctaUrl?: string
  altLinkLabel?: string
  outro?: React.ReactNode
  extra?: React.ReactNode
}

export function BrandLayout({
  preview,
  title,
  intro,
  ctaLabel,
  ctaUrl,
  altLinkLabel,
  outro,
  extra,
}: BrandLayoutProps) {
  return (
    <Html lang="pt" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={brand.page}>
        <Container style={brand.container}>
          <Section style={brand.headerBar}>
            <Heading as="h1" style={brand.brandName}>
              DERDALAX
            </Heading>
          </Section>
          <Section style={brand.goldStrip} />
          <Section style={brand.content}>
            <Heading as="h2" style={brand.h1}>
              {title}
            </Heading>
            <Text style={brand.paragraph}>{intro}</Text>
            {extra}
            {ctaLabel && ctaUrl && (
              <>
                <Button href={ctaUrl} style={brand.button}>
                  {ctaLabel}
                </Button>
                <Text style={brand.altLinkLabel}>
                  {altLinkLabel ?? 'Se o botão não funcionar, copie e cole este link:'}
                </Text>
                <Text style={{ margin: 0 }}>
                  <a href={ctaUrl} style={brand.altLink}>
                    {ctaUrl}
                  </a>
                </Text>
              </>
            )}
            {outro && <Text style={{ ...brand.paragraph, marginTop: '28px', fontSize: '13px' }}>{outro}</Text>}
          </Section>
          <Section style={brand.footer}>
            <Text style={brand.footerBrand}>DERDALAX</Text>
            <Text style={brand.footerTagline}>Moda e estilo, feitos em Moçambique.</Text>
            <Text style={{ ...brand.footerTagline, marginTop: '10px' }}>
              <a href="https://derdalax.co.mz/suporte" style={{ color: '#8a8a8a', textDecoration: 'underline' }}>Termos e Condições</a>
              {' · '}
              <a href="https://derdalax.co.mz/suporte" style={{ color: '#8a8a8a', textDecoration: 'underline' }}>Política de Privacidade</a>
            </Text>
            <Text style={{ ...brand.footerTagline, marginTop: '8px' }}>
              Dúvidas? Responda este email ou escreva para{' '}
              <a href="mailto:suporte@derdalax.co.mz" style={{ color: '#8a8a8a', textDecoration: 'underline' }}>suporte@derdalax.co.mz</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

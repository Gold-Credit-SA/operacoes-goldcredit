import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Gold Credit'

interface CobrancaAvisoProps {
  assunto?: string
  corpo?: string
  sacado_nome?: string
  cedente_nome?: string
  numero_titulo?: string
  valor?: string
  vencimento?: string
  dias_atraso?: string | number
}

const CobrancaAvisoEmail = ({
  corpo,
  sacado_nome,
}: CobrancaAvisoProps) => {
  const paragrafos = (corpo ?? '').split('\n').filter(Boolean)
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Aviso de cobrança — ${sacado_nome ?? ''}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Aviso de Cobrança</Heading>
          <Section style={card}>
            {paragrafos.length === 0 ? (
              <Text style={text}>{corpo}</Text>
            ) : (
              paragrafos.map((p, i) => <Text key={i} style={text}>{p}</Text>)
            )}
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Este é um aviso automático enviado por {SITE_NAME}. Em caso de dúvida, responda este e-mail.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CobrancaAvisoEmail,
  subject: (d: Record<string, any>) => d?.assunto || 'Aviso de cobrança',
  displayName: 'Aviso de Cobrança',
  previewData: {
    assunto: 'Título em atraso',
    corpo: 'Olá, identificamos um título em atraso. Por favor, regularize.',
    sacado_nome: 'CLIENTE EXEMPLO',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 12px', whiteSpace: 'pre-wrap' as const }
const card = { backgroundColor: '#f7f7f5', border: '1px solid #ececec', padding: '18px 20px', borderRadius: '4px' }
const hr = { borderColor: '#eee', margin: '28px 0 14px' }
const footer = { fontSize: '11px', color: '#999', textAlign: 'center' as const }

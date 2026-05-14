import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Operações Gold Credit'
const APP_URL = 'https://operacoes.goldcreditcapital.com.br/nfe'

interface NfeEventoProps {
  chave?: string
  tipoEvento?: string
  descricao?: string
  dataEvento?: string
  descricaoChave?: string
}

function fmtChave(c?: string) {
  if (!c) return '—'
  return c.replace(/(\d{4})/g, '$1 ').trim()
}

const NfeEventoEmail = ({
  chave,
  tipoEvento,
  descricao,
  dataEvento,
  descricaoChave,
}: NfeEventoProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo evento na NF-e monitorada{descricaoChave ? ` (${descricaoChave})` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Evento de NF-e recebido</Heading>
        <Text style={text}>
          A SERPRO notificou um novo evento em uma chave de NF-e monitorada na plataforma {SITE_NAME}.
        </Text>

        <Section style={card}>
          <Row label="Descrição" value={descricaoChave || '—'} />
          <Row label="Chave" value={fmtChave(chave)} mono />
          <Row label="Tipo do evento" value={tipoEvento || '—'} />
          <Row label="Descrição" value={descricao || '—'} />
          <Row label="Data do evento" value={dataEvento ? new Date(dataEvento).toLocaleString('pt-BR') : '—'} />
        </Section>

        <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
          <Button href={APP_URL} style={button}>Ver na plataforma</Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Você recebeu este e-mail porque está cadastrado como gestor em {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <table style={{ width: '100%', marginBottom: '10px' }}>
      <tbody>
        <tr>
          <td style={{ width: '38%', color: '#777', fontSize: '12px', verticalAlign: 'top', padding: '4px 0' }}>{label}</td>
          <td style={{ color: '#111', fontSize: '14px', fontFamily: mono ? 'monospace' : 'Arial, sans-serif', padding: '4px 0' }}>{value}</td>
        </tr>
      </tbody>
    </table>
  )
}

export const template = {
  component: NfeEventoEmail,
  subject: (d: Record<string, any>) =>
    `NF-e: novo evento${d?.tipoEvento ? ` (${d.tipoEvento})` : ''}`,
  displayName: 'Evento de NF-e (SERPRO)',
  previewData: {
    chave: '35170608530528000184550000000154301000771561',
    tipoEvento: '110111',
    descricao: 'Cancelamento',
    dataEvento: new Date().toISOString(),
    descricaoChave: 'NF cliente XPTO',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.5', margin: '0 0 18px' }
const card = { backgroundColor: '#f7f7f5', border: '1px solid #ececec', padding: '18px 20px', borderRadius: '4px' }
const button = { backgroundColor: '#111', color: '#fff', padding: '12px 22px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold', borderRadius: '2px' }
const hr = { borderColor: '#eee', margin: '28px 0 14px' }
const footer = { fontSize: '11px', color: '#999', textAlign: 'center' as const }

import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  token?: string
}

export const MagicLinkEmail = ({ siteName, token = '000000' }: MagicLinkEmailProps) => (
  <Html lang="bn" dir="ltr">
    <Head />
    <Preview>{siteName} লগইন কোড: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>লগইন কোড</Heading>
        <Text style={text}>অ্যাপে লগইন করতে নিচের ৬ ডিজিটের কোডটি বসান।</Text>
        <Section style={codeBox}>
          <Text style={codeText}>{token}</Text>
        </Section>
        <Text style={muted}>কোডটি ১০ মিনিট পর্যন্ত কাজ করবে। কাউকে শেয়ার করবেন না।</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '480px' }
const brand = { fontSize: '13px', fontWeight: 700, color: '#0ea5e9', letterSpacing: '1px', margin: '0 0 8px' }
const h1 = { fontSize: '22px', color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '22px', margin: '0 0 16px' }
const codeBox = {
  backgroundColor: '#0f172a',
  borderRadius: '14px',
  padding: '18px',
  textAlign: 'center' as const,
  margin: '0 0 16px',
}
const codeText = {
  color: '#ffffff',
  fontSize: '30px',
  fontWeight: 700,
  letterSpacing: '8px',
  margin: 0,
}
const muted = { fontSize: '12px', color: '#64748b', lineHeight: '19px', margin: 0 }

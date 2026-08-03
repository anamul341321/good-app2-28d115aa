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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="bn" dir="ltr">
    <Head />
    <Preview>Good-App ভেরিফিকেশন কোড: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Good-App</Text>
        <Heading style={h1}>ভেরিফিকেশন কোড</Heading>
        <Text style={text}>
          আপনার পরিচয় নিশ্চিত করতে নিচের কোডটি ব্যবহার করুন।
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{token}</Text>
        </Section>
        <Text style={muted}>
          এই কোডটি অল্প সময়ের মধ্যে মেয়াদ শেষ হবে। যদি আপনি এই অনুরোধ না করে থাকেন, মেইলটি বাদ দিন।
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '480px' }
const brand = { fontSize: '13px', fontWeight: 700, color: '#0ea5e9', letterSpacing: '1px', margin: '0 0 8px' }
const h1 = { fontSize: '22px', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '22px', margin: '0 0 16px' }
const codeBox = {
  backgroundColor: '#0f172a',
  borderRadius: '14px',
  padding: '18px',
  textAlign: 'center' as const,
  margin: '0 0 16px',
}
const codeText = {
  fontSize: '30px',
  fontWeight: 800,
  letterSpacing: '8px',
  color: '#ffffff',
  margin: 0,
}
const muted = { fontSize: '12px', color: '#64748b', lineHeight: '19px', margin: 0 }

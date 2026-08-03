import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="bn" dir="ltr">
    <Head />
    <Preview>{siteName}-এ আপনার পাসওয়ার্ড রিসেট করুন</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>পাসওয়ার্ড রিসেট করুন</Heading>
        <Text style={text}>
          {siteName}-এ আপনার পাসওয়ার্ড রিসেট করার একটি অনুরোধ পাওয়া গেছে। নতুন পাসওয়ার্ড সেট করতে নিচের বাটনে ক্লিক করুন।
        </Text>
        <Button style={button} href={confirmationUrl}>
          পাসওয়ার্ড রিসেট করুন
        </Button>
        <Text style={muted}>
          যদি আপনি পাসওয়ার্ড রিসেট না চেয়ে থাকেন, এই মেইলটি বাদ দিন। আপনার পাসওয়ার্ড অপরিবর্তিত থাকবে।
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '480px' }
const brand = { fontSize: '13px', fontWeight: 700, color: '#0ea5e9', letterSpacing: '1px', margin: '0 0 8px' }
const h1 = { fontSize: '22px', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '22px', margin: '0 0 16px' }
const button = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 700,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '0 0 16px',
}
const muted = { fontSize: '12px', color: '#64748b', lineHeight: '19px', margin: 0 }

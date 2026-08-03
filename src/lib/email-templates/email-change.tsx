import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="bn" dir="ltr">
    <Head />
    <Preview>{siteName}-এ আপনার ইমেইল পরিবর্তন নিশ্চিত করুন</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>ইমেইল পরিবর্তন নিশ্চিত করুন</Heading>
        <Text style={text}>
          আপনি {siteName}-এ আপনার ইমেইল ঠিকানা পরিবর্তন করতে চেয়েছেন — {' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          থেকে{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          ।
        </Text>
        <Text style={text}>
          এই পরিবর্তনটি নিশ্চিত করতে নিচের বাটনে ক্লিক করুন:
        </Text>
        <Button style={button} href={confirmationUrl}>
          ইমেইল পরিবর্তন নিশ্চিত করুন
        </Button>
        <Text style={muted}>
          যদি আপনি এই পরিবর্তন না চেয়ে থাকেন, দ্রুত আপনার একাউন্ট সুরক্ষিত করুন।
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '480px' }
const brand = { fontSize: '13px', fontWeight: 700, color: '#0ea5e9', letterSpacing: '1px', margin: '0 0 8px' }
const h1 = { fontSize: '22px', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '22px', margin: '0 0 16px' }
const link = { color: '#0ea5e9', textDecoration: 'none' }
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

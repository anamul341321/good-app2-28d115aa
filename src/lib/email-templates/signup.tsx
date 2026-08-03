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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="bn" dir="ltr">
    <Head />
    <Preview>{siteName}-এ সাইন আপ করার জন্য ধন্যবাদ — ইমেইল নিশ্চিত করুন</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>আপনার ইমেইল নিশ্চিত করুন</Heading>
        <Text style={text}>
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          -এ সাইন আপ করার জন্য ধন্যবাদ!
        </Text>
        <Text style={text}>
          আপনার ইমেইল ঠিকানা ({' '}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>{' '}
          ) নিশ্চিত করতে নিচের বাটনে ক্লিক করুন:
        </Text>
        <Button style={button} href={confirmationUrl}>
          ইমেইল ভেরিফাই করুন
        </Button>
        <Text style={muted}>
          যদি আপনি নিজে একাউন্ট না করে থাকেন, এই মেইলটি বাদ দিতে পারেন।
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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

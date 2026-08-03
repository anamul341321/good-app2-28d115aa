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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="bn" dir="ltr">
    <Head />
    <Preview>{siteName}-তে আপনাকে আমন্ত্রণ জানানো হয়েছে</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>আপনাকে আমন্ত্রণ জানানো হয়েছে</Heading>
        <Text style={text}>
          আপনাকে{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          -তে যোগ দেওয়ার জন্য আমন্ত্রণ জানানো হয়েছে। আমন্ত্রণটি গ্রহণ করে একাউন্ট তৈরি করতে নিচের বাটনে ক্লিক করুন।
        </Text>
        <Button style={button} href={confirmationUrl}>
          আমন্ত্রণ গ্রহণ করুন
        </Button>
        <Text style={muted}>
          যদি আপনি এই আমন্ত্রণ আশা না করেন, এই মেইলটি বাদ দিতে পারেন।
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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

import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  code?: string;
  name?: string;
}

const Email = ({ code = "000000", name }: Props) => (
  <Html lang="bn" dir="ltr">
    <Head />
    <Preview>Good-App ইমেইল ভেরিফিকেশন কোড: {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Good-App</Text>
        <Heading style={h1}>ইমেইল ভেরিফিকেশন কোড</Heading>
        <Text style={text}>
          {name ? `${name},` : "হ্যালো,"} আপনার একাউন্টের সাথে এই ইমেইলটি লিংক করতে
          নিচের ৬ ডিজিটের কোডটি অ্যাপে বসান।
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code}</Text>
        </Section>
        <Text style={muted}>
          কোডটি ১০ মিনিট পর্যন্ত কাজ করবে। কোডটি কাউকে শেয়ার করবেন না। আপনি যদি
          এই অনুরোধ না করে থাকেন, মেইলটি বাদ দিন।
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Good-App ইমেইল ভেরিফিকেশন কোড",
  displayName: "Email verification code",
  previewData: { code: "482913", name: "Anamul" },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "28px 24px", maxWidth: "480px" };
const brand = { fontSize: "13px", fontWeight: 700, color: "#0ea5e9", letterSpacing: "1px", margin: "0 0 8px" };
const h1 = { fontSize: "22px", color: "#0f172a", margin: "0 0 12px" };
const text = { fontSize: "14px", color: "#334155", lineHeight: "22px", margin: "0 0 16px" };
const codeBox = {
  backgroundColor: "#0f172a",
  borderRadius: "14px",
  padding: "18px",
  textAlign: "center" as const,
  margin: "0 0 16px",
};
const codeText = {
  fontSize: "30px",
  fontWeight: 800,
  letterSpacing: "8px",
  color: "#ffffff",
  margin: 0,
};
const muted = { fontSize: "12px", color: "#64748b", lineHeight: "19px", margin: 0 };

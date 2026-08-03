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
    <Preview>Good-App পাসওয়ার্ড রিসেট কোড: {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Good-App</Text>
        <Heading style={h1}>পাসওয়ার্ড রিসেট কোড</Heading>
        <Text style={text}>
          {name ? `${name},` : "হ্যালো,"} নিচের ৬ ডিজিটের কোডটি অ্যাপে বসিয়ে নতুন পাসওয়ার্ড সেট করুন।
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code}</Text>
        </Section>
        <Text style={muted}>
          কোডটি ১০ মিনিট পর্যন্ত কাজ করবে। কোডটি কাউকে শেয়ার করবেন না। আপনি যদি
          পাসওয়ার্ড রিসেট না চেয়ে থাকেন, এই মেইলটি বাদ দিন।
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Good-App পাসওয়ার্ড রিসেট কোড",
  displayName: "Password reset code",
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
const codeText = { fontSize: "32px", fontWeight: 700, letterSpacing: "10px", color: "#fbbf24", margin: "0" };
const muted = { fontSize: "12px", color: "#64748b", lineHeight: "18px", margin: "0" };

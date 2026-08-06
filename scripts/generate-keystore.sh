#!/usr/bin/env bash
set -e

echo "============================================"
echo "  Good-App Play Store Signing Key Generator"
echo "============================================"
echo ""
echo "এই স্ক্রিপ্ট Play Store-এর জন্য একটি Signing Key বানাবে।"
echo "পাসওয়ার্ডটা মনে রাখবেন — হারালে আর app update দিতে পারবেন না।"
echo ""

KEY_FILE="goodapp.jks"
ALIAS="goodapp"

echo "Step 1/3: Keystore ফাইল তৈরি হচ্ছে..."
keytool -genkey -v \
  -keystore "$KEY_FILE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

echo ""
echo "Step 2/3: Base64 এনকোড করা হচ্ছে (GitHub Secrets-এ বসানোর জন্য)..."
BASE64_KEY=$(base64 -w 0 "$KEY_FILE")

echo ""
echo "============================================"
echo "  ✅ তৈরি হয়েছে! নিচের লম্বা লেখাটা কপি করুন:"
echo "============================================"
echo ""
echo "$BASE64_KEY"
echo ""
echo "============================================"
echo "  📋 GitHub Secrets-এ এভাবে বসান:"
echo "============================================"
echo "  ANDROID_KEYSTORE_BASE64   -> উপরের লম্বা লেখাটা"
echo "  ANDROID_KEYSTORE_PASSWORD -> আপনার দেওয়া keystore পাসওয়ার্ড"
echo "  ANDROID_KEY_ALIAS           -> goodapp"
echo "  ANDROID_KEY_PASSWORD        -> আপনার দেওয়া key পাসওয়ার্ড"
echo ""
echo "💾 goodapp.jks ফাইলটাও ডাউনলোড করে Google Drive-এ রাখুন।"
echo ""

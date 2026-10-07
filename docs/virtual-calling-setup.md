# Virtual Calling — Complete Setup Guide

This guide walks you through setting up virtual calling in your CRM, provider by provider. Virtual calling lets you dial leads from the CRM without revealing your personal phone number — the call routes through a virtual number, calling your agent phone first, then connecting you to the lead.

---

## Table of Contents

1. [How Virtual Calling Works](#1-how-virtual-calling-works)
2. [Choose Your Provider](#2-choose-your-provider)
3. [Twilio Setup](#3-twilio-setup)
4. [Exotel Setup](#4-exotel-setup)
5. [Plivo Setup](#5-plivo-setup)
6. [WhatsApp Calling Setup](#6-whatsapp-calling-setup)
7. [Enter Credentials in Your CRM](#7-enter-credentials-in-your-crm)
8. [Making Calls from the CRM](#8-making-calls-from-the-crm)
9. [Call Logs and History](#9-call-logs-and-history)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. How Virtual Calling Works

When you click "Call" on a lead in the CRM, here's what happens:

1. The CRM sends a request to your calling provider (Twilio, Exotel, or Plivo)
2. The provider **first calls your agent phone number** (the phone you carry)
3. You pick up — you hear ringing or a connect prompt
4. The provider **then calls the lead's phone number**
5. When the lead answers, both calls are bridged together
6. Both parties see the **virtual number** on caller ID — neither sees the other's real number

This is called "click-to-call" or "number masking." It protects privacy and keeps calls professional.

### What You Need

- An account with one of the supported providers (Twilio, Exotel, or Plivo)
- A virtual phone number purchased from that provider
- Your real phone number (the "agent number" where the provider calls you first)
- API credentials from your provider (Account SID, Auth Token, etc.)

---

## 2. Choose Your Provider

| Provider | Best For | Phone Numbers | Pricing | Website |
|----------|----------|---------------|---------|--------|
| **Twilio** | Global, developer-friendly | Numbers in 100+ countries | Pay-per-minute | [twilio.com](https://www.twilio.com) |
| **Exotel** | India-focused | Indian +91 numbers | Indian Rupee billing | [exotel.com](https://www.exotel.com) |
| **Plivo** | Global, competitive pricing | Numbers in 14+ countries | Pay-per-minute | [plivo.com](https://www.plivo.com) |

### Quick Recommendation

- **If you're in India**: Use **Exotel** — they understand Indian regulations, provide local +91 numbers, and handle DND (Do Not Disturb) compliance automatically.
- **If you're global**: Use **Twilio** — the most mature platform with the best documentation and widest country coverage.
- **If you want lower costs**: Use **Plivo** — often cheaper than Twilio for similar coverage.

---

## 3. Twilio Setup

### 3.1 Create a Twilio Account

1. Go to [twilio.com](https://www.twilio.com) and click **Sign Up**
2. Enter your name, email, and password
3. Verify your email address
4. Add your phone number and verify it via SMS (this becomes your trial number)
5. Twilio will give you **trial credits** (usually $15–$25) to test with

### 3.2 Get Your Account Credentials

1. Log in to the [Twilio Console](https://console.twilio.com)
2. On the dashboard home page, you'll see:
   - **Account SID** — starts with `AC` followed by a long string (e.g., `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Auth Token** — a long string of characters
3. Copy both of these — you'll need them for the CRM

> **Important**: Keep your Auth Token secret. Anyone with your Account SID and Auth Token can make calls and send messages on your behalf.

### 3.3 Buy a Phone Number

1. In the Twilio Console, go to **Phone Numbers** > **Manage** > **Buy a number**
2. Search for a number:
   - Select your country (e.g., United States, India, United Kingdom)
   - You can filter by area code, capabilities (make sure **Voice** is checked), or type (local, toll-free, mobile)
3. Click **Buy** next to a number you like
4. Confirm the purchase (numbers cost $1–$15/month depending on country and type)

> **For India**: Twilio does not sell Indian +91 numbers directly to most businesses. If you need an Indian number, use **Exotel** instead (see section 4).

### 3.4 Configure the Number (Optional but Recommended)

1. Go to **Phone Numbers** > **Manage** > **Active numbers**
2. Click on your new number
3. Under **Voice & Fax**:
   - **A Call Comes In**: Set to "TwiML App" or leave default for now — the CRM handles call routing through the API
4. Click **Save**

### 3.5 Upgrade from Trial (Required for Production)

With a trial account, you can only call **verified numbers** (numbers you've added to Twilio's verified caller list). To call any number:

1. Go to **Billing** > **Upgrade**
2. Add a credit card or set up auto-recharge
3. Your account is now production-ready — you can call any phone number

### 3.6 What You Need for the CRM

Collect these four values:

| Field | Where to Find It | Example |
|-------|-----------------|---------|
| **Account SID** | Twilio Console dashboard | `AC1234abcd5678efgh...` |
| **Auth Token** | Twilio Console dashboard (click the eye icon to reveal) | `a1b2c3d4e5f6...` |
| **Twilio Phone Number** | Phone Numbers > Active numbers | `+12345678901` |
| **Agent Phone Number** | Your real phone number where calls ring first | `+919876543210` |

---

## 4. Exotel Setup

### 4.1 Create an Exotel Account

1. Go to [exotel.com](https://www.exotel.com) and click **Sign Up**
2. Fill in your business details (Exotel may require business verification for Indian numbers)
3. Verify your email and phone number
4. Exotel will assign an account manager to help you get set up (they have a guided onboarding process for Indian businesses)

### 4.2 Get Your API Credentials

1. Log in to your Exotel dashboard
2. Go to **Settings** > **API**
3. You'll see:
   - **Account SID** (also called "SID" or "Exotel SID") — a short alphanumeric string (e.g., `yourcompany1`)
   - **Auth Token** — a long alphanumeric string
4. Copy both

> Exotel's Account SID is typically your company name or a short identifier, not a long string like Twilio's.

### 4.3 Get a Virtual Number (DID)

1. In the Exotel dashboard, go to **Numbers** > **DID Numbers**
2. Click **Buy Number** or **Get Number**
3. Select a number from the available pool (these are Indian +91 numbers)
4. The number is assigned to your account immediately

Exotel also supports **shared numbers** (a pool of numbers used round-robin) if you don't want a dedicated number.

### 4.4 Configure Call Flow (Optional)

Exotel uses "Call Flows" or "PAS" (Phone Number Applet) to define what happens when someone calls your virtual number. For the CRM's click-to-call feature, you don't need a custom call flow — the API handles the routing. But if you want incoming calls to forward to your phone:

1. Go to **Call Flows** > **Create New**
2. Add a **Connect** applet pointing to your agent number
3. Assign this flow to your virtual number

### 4.5 What You Need for the CRM

Collect these four values:

| Field | Where to Find It | Example |
|-------|-----------------|---------|
| **Account SID** | Exotel dashboard > Settings > API | `yourcompany1` |
| **Auth Token** | Exotel dashboard > Settings > API | `a1b2c3d4e5f6...` |
| **Exotel Virtual Number** | Exotel dashboard > Numbers | `+918012345678` |
| **Agent Phone Number** | Your real phone number | `+919876543210` |

---

## 5. Plivo Setup

### 5.1 Create a Plivo Account

1. Go to [plivo.com](https://www.plivo.com) and click **Sign Up**
2. Enter your name, email, and password
3. Verify your email address
4. Verify your phone number via SMS
5. Plivo provides free trial credits to test with

### 5.2 Get Your API Credentials

1. Log in to the [Plivo Console](https://console.plivo.com)
2. Go to **Overview** or **Credentials** (sometimes under Settings)
3. You'll see:
   - **Auth ID** (this is your Account SID equivalent) — a long alphanumeric string
   - **Auth Token** — another long alphanumeric string
4. Copy both

### 5.3 Buy a Phone Number

1. In the Plivo Console, go to **Phone Numbers** > **Buy Number**
2. Search by country and type (Local, Toll-Free, Mobile)
3. Make sure the number has **Voice** capability
4. Click **Buy** to purchase
5. Numbers cost approximately $0.80–$3.00/month depending on country

### 5.4 Configure the Number

1. Go to **Phone Numbers** > **Your Numbers**
2. Click on your purchased number
3. Under **Application**, you can leave it unassigned for now — the CRM uses the API directly to place calls
4. If you want incoming calls to forward to your phone, create a Plivo Application with an XML response that dials your agent number, then assign it to the phone number

### 5.5 Upgrade from Trial

With a trial account, you can only call verified numbers. To call any number:

1. Go to **Billing** > **Add Credits** or **Upgrade**
2. Add a credit card and add at least $10 in credits
3. Your account is now production-ready

### 5.6 What You Need for the CRM

Collect these four values:

| Field | Where to Find It | Example |
|-------|-----------------|---------|
| **Account SID** | Plivo Console > Overview | | `MA1234567890123456...` |
| **Auth Token** | Plivo Console > Overview | `a1b2c3d4e5f6...` |
| **Plivo Phone Number** | Plivo Console > Phone Numbers | `+12345678901` |
| **Agent Phone Number** | Your real phone number | `+919876543210` |

---

## 6. WhatsApp Calling Setup

WhatsApp calling lets you place voice calls through WhatsApp's Cloud API instead of a traditional phone provider. This is a separate system from virtual calling — calls go through WhatsApp's WebRTC infrastructure, not the phone network.

For the full WhatsApp calling setup guide, see **[WhatsApp Calling Setup](./whatsapp-calling-setup.md)** — it covers Meta Business account creation, phone number verification, calling enablement, payment method setup, webhook configuration, and the permission flow in detail.

### Quick Summary

1. Create a Meta Business account and Meta App with WhatsApp
2. Add and verify a WhatsApp Business phone number
3. Enable calling on the number via the Meta API
4. Add a payment method to your WhatsApp Business Account (required)
5. Configure the webhook in your Meta App dashboard
6. Enter credentials in the CRM under **Settings > WhatsApp**

WhatsApp calling is free per-minute but requires contacts to grant call permission first.

---

## 7. Enter Credentials in Your CRM

### 7.1 For Virtual Calling (Twilio / Exotel / Plivo)

1. Log in to your CRM
2. Click the **Settings** (gear icon)
3. Select the **Virtual Calling** tab
4. **Choose your provider**: Click on Twilio, Exotel, or Plivo
5. Enter the four fields:
   - **Account SID** — from your provider's dashboard
   - **Auth Token** — from your provider's dashboard
   - **Phone Number** — your virtual number in E.164 format (e.g., `+12345678901`)
   - **Agent Number** — your real phone number in E.164 format (e.g., `+919876543210`)
6. Click **Save**

### 7.2 For WhatsApp Calling

1. Go to **Settings** > **WhatsApp** tab
2. Enter:
   - **Phone Number ID** — from Meta App dashboard
   - **Access Token** — from Meta System User
   - **Verify Token** — any string you choose (or leave blank to auto-generate)
   - **WABA ID** — WhatsApp Business Account ID
   - **Connected Phone Number** — your business number in international format
   - **Meta App ID** — from your Meta App dashboard
3. Click **Save**

### 7.3 Phone Number Format (E.164)

All phone numbers must be in **E.164 format**:

- Start with `+`
- Followed by country code
- Then the full number without spaces, dashes, or parentheses

| Country | Example E.164 |
|---------|--------------|
| India | `+919876543210` |
| United States | `+12125551234` |
| United Kingdom | `+447911123456` |
| Australia | `+61412345678` |

Do NOT include: spaces (`+91 98765 43210`), dashes (`+91-98765-43210`), parentheses (`+1(212)555-1234`), or leading zeros (`+9109876543210`).

---

## 8. Making Calls from the CRM

### 8.1 Virtual Call (Phone)

1. Open any lead in the CRM
2. Click the **Call** button (phone icon)
3. Select the **Phone** call mode (not WhatsApp)
4. Enter or confirm the lead's phone number
5. Click **Call**
6. Your phone (agent number) rings first — pick up
7. The system then calls the lead and connects you both
8. When done, simply hang up your phone

### 8.2 WhatsApp Call

1. Open a WhatsApp conversation with the lead in the CRM inbox
2. Click the **phone icon** next to the contact's name
3. If the contact has granted call permission, the call connects via WebRTC
4. If not, a permission request is sent — wait for the contact to grant it, then call again
5. Your browser will ask for microphone access — click **Allow**

### 8.3 Switching Between Modes

In the call dialog, you'll see two tabs: **Phone** and **WhatsApp**. Click either to switch modes before placing a call.

- **Phone mode** uses your virtual calling provider (Twilio/Exotel/Plivo)
- **WhatsApp mode** uses WhatsApp's Cloud API

---

## 9. Call Logs and History

All calls are logged in the database automatically. You can view:

- **Call date and time**
- **Direction** (outgoing or incoming)
- **Phone numbers** (agent, lead, and virtual number)
- **Call duration**
- **Call status** (completed, failed, no-answer, busy)
- **Provider** used (Twilio, Exotel, Plivo, or WhatsApp)
- **Recording and transcription** (WhatsApp only — see the WhatsApp guide)

Call logs appear in the lead's activity timeline and in the CRM's call history view.

---

## 10. Troubleshooting

### "Call failed immediately"

**Possible causes:**
- **Trial account**: You're on a trial and calling an unverified number. Upgrade your account or verify the number first.
- **Insufficient credits**: Your account balance is too low. Add credits.
- **Wrong number format**: The phone number is not in E.164 format. Remove spaces, dashes, and parentheses.
- **Invalid credentials**: Double-check your Account SID and Auth Token.

**Fix**: Check the error message in the CRM call dialog. For more details, check your provider's dashboard call logs.

### "My phone rings but the call drops when I pick up"

**Cause**: The agent number is not in E.164 format, or the lead's number is invalid.

**Fix**: Ensure both your agent number and the lead's number include the country code with a `+` prefix.

### "The lead's phone never rings"

**Cause**: The lead's phone number may be invalid, or the number is in a country your provider doesn't support.

**Fix**:
- Verify the lead's phone number is correct
- Check if your provider supports calls to that country
- For India: DND (Do Not Disturb) numbers may block marketing calls — use Exotel which handles DND compliance

### "I hear a message saying the number is not verified"

**Cause**: You're on a trial account (Twilio or Plivo). Trial accounts can only call numbers you've verified in the provider dashboard.

**Fix**: Upgrade to a paid account, or add the lead's number to your provider's verified numbers list.

### "WhatsApp call says permission needed"

**Cause**: The contact hasn't granted call permission. WhatsApp requires explicit consent before businesses can call.

**Fix**: The CRM automatically sends a permission request. Wait for the contact to tap "Allow" in their WhatsApp, then try calling again. See the [WhatsApp Calling Setup guide](./whatsapp-calling-setup.md) for details.

### "Browser microphone not working (WhatsApp calls)"

**Cause**: Your browser blocked microphone access.

**Fix**:
1. Click the lock or camera icon in your browser's address bar
2. Allow microphone access for the site
3. Refresh the page and try again

### "Exotel calls not going through"

**Cause**: Exotel requires business verification for Indian numbers. Your account may still be in the verification process.

**Fix**:
1. Check your Exotel dashboard for account verification status
2. Contact Exotel support if verification is pending
3. Ensure your Exotel SID is correct (it's a short name, not a long string)

### Costs are higher than expected

**Tip**: Most providers charge per minute. Calls are billed from when the agent picks up until the call ends. To reduce costs:
- Keep calls concise
- Review call logs in your provider's dashboard
- Compare rates between providers — Plivo is often cheaper than Twilio
- For India, Exotel's pricing is in Rupees and may be more cost-effective

---

## Quick Reference: Provider Comparison

| Feature | Twilio | Exotel | Plivo |
|---------|--------|--------|-------|
| Indian numbers | No | Yes (+91) | Limited |
| Global numbers | Yes (100+ countries) | India only | Yes (14+ countries) |
| Trial credits | $15–$25 | Contact sales | Free trial |
| Documentation | Excellent | Good | Good |
| Pricing model | Per minute | Per minute / per call | Per minute |
| Best for | Global businesses | Indian businesses | Cost-conscious global |

---

## Checklist

### Virtual Calling (choose one provider)

- [ ] Provider account created (Twilio / Exotel / Plivo)
- [ ] Account SID copied
- [ ] Auth Token copied
- [ ] Virtual phone number purchased
- [ ] Account upgraded from trial (if applicable)
- [ ] Agent phone number confirmed (your real number)
- [ ] Credentials entered in CRM > Settings > Virtual Calling
- [ ] Test call placed successfully

### WhatsApp Calling (separate setup)

- [ ] Meta Business Account created
- [ ] Meta App with WhatsApp product created
- [ ] Phone number added and verified
- [ ] Calling enabled on the phone number
- [ ] Payment method added to WhatsApp Business Account
- [ ] Webhook configured in Meta App dashboard
- [ ] Credentials entered in CRM > Settings > WhatsApp
- [ ] Test call placed successfully

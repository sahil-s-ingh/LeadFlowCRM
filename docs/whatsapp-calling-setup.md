# WhatsApp Cloud API Calling — Complete Setup Guide

This guide walks you through every step needed to enable WhatsApp calling (voice calls through WhatsApp) in your CRM. Follow each section in order.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create a Meta Business Account](#2-create-a-meta-business-account)
3. [Create a Meta App with WhatsApp](#3-create-a-meta-app-with-whatsapp)
4. [Add a WhatsApp Business Phone Number](#4-add-a-whatsapp-business-phone-number)
5. [Enable Calling on the Phone Number](#5-enable-calling-on-the-phone-number)
6. [Add a Payment Method (Required for Calling)](#6-add-a-payment-method-required-for-calling)
7. [Get Your API Credentials](#7-get-your-api-credentials)
8. [Configure the Webhook](#8-configure-the-webhook)
9. [Enter Credentials in Your CRM](#9-enter-credentials-in-your-crm)
10. [How Calling Works in This App](#10-how-calling-works-in-this-app)
11. [Call Permission Flow](#11-call-permission-flow)
12. [Recording and Transcription (Optional)](#12-recording-and-transcription-optional)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

- A **Meta Business Manager** account (free to create at [business.facebook.com](https://business.facebook.com))
- A **phone number** that is NOT already registered with WhatsApp (you cannot use a number that has a personal WhatsApp account)
- A **business name** and **category** (e.g., "Real Estate", "Financial Services")
- A **credit card or bank account** — Meta requires a payment method on file before calling works
- Admin access to your Supabase project (for webhook configuration)

---

## 2. Create a Meta Business Account

1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Create Account**
3. Enter your business name and your name
4. Enter your business email address
5. Select your business category
6. Click **Create**

You will be taken to your Business Manager dashboard. Note your **Business Manager ID** (visible in the URL or under Business Settings > Business info).

---

## 3. Create a Meta App with WhatsApp

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps** > **Create App**
3. Select **Business** as the app type
4. Enter an app name (e.g., "LeadCentre CRM")
5. Enter your contact email
6. Select your Business Manager account from step 2
7. Click **Create App**

Once the app is created:

1. On the app dashboard, find the **WhatsApp** product
2. If it's not added, click **Add Product** > **WhatsApp** > **Set Up**
3. You will see a **WhatsApp Business Account (WABA)** has been created or linked

---

## 4. Add a WhatsApp Business Phone Number

1. In your Meta App dashboard, go to **WhatsApp** > **Phone Numbers**
2. Click **Add Phone Number**
3. Enter:
   - **Display name** (what customers see, e.g., "LeadCentre Support")
   - **Phone number** (must not be registered with any other WhatsApp account)
   - **Category** (your business category)
   - **Description** (short description of your business)
4. Click **Next**
5. You will receive a verification code via SMS or voice call to that number
6. Enter the code to verify the number

Once verified, you will see:
- **Phone Number ID** — a long numeric ID (copy this, you'll need it later)
- **WhatsApp Business Account ID (WABA ID)** — another long numeric ID

---

## 5. Enable Calling on the Phone Number

WhatsApp calling is NOT enabled by default. You must explicitly turn it on.

### Option A: Through the API (recommended)

Run this command, replacing `PHONE_NUMBER_ID` and `ACCESS_TOKEN`:

```bash
curl -X POST "https://graph.facebook.com/v21.0/PHONE_NUMBER_ID/settings" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "calling": {
      "status": "ENABLED",
      "call_icon_visibility": "DEFAULT",
      "callback_permission_status": "ENABLED",
      "call_hours": {
        "status": "DISABLED"
      }
    }
  }'
```

### Option B: Through the CRM Settings page

Your CRM has a built-in call settings panel. Go to **Settings > WhatsApp** and use the calling configuration controls to enable calling, set call icon visibility, and configure callback permissions.

### Verify calling is enabled

```bash
curl "https://graph.facebook.com/v21.0/PHONE_NUMBER_ID/settings" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

You should see:
```json
{
  "calling": {
    "status": "ENABLED",
    "call_icon_visibility": "DEFAULT",
    "callback_permission_status": "ENABLED",
    "call_hours": {
      "status": "DISABLED",
      "timezone_id": ""
    }
  }
}
```

---

## 6. Add a Payment Method (Required for Calling)

This is the most commonly missed step. Meta requires a valid payment method on your WhatsApp Business Account before you can place or receive calls. Without it, you will get the error:

> **"Business eligibility payment issue for calling"** (error code 131044)

### Steps:

1. Go to [business.facebook.com](https://business.facebook.com) > **Business Settings**
2. Navigate to **Billing** > **Payment methods**
3. Click **Add payment method**
4. Enter your credit card or bank account details
5. Ensure the payment method is assigned to your WhatsApp Business Account:
   - Go to **WhatsApp Manager** ([business.facebook.com/wa](https://business.facebook.com/wa))
   - Select your WhatsApp Business Account
   - Go to **Billing** or **Payment settings**
   - Confirm the payment method is linked to this WABA

### Verify billing is configured

After adding the payment method, try a test call. If you still get the "Business eligibility payment issue" error, wait 24 hours for Meta to process the payment method, then try again.

---

## 7. Get Your API Credentials

You need three pieces of information:

### 7.1 Phone Number ID

1. Go to your Meta App dashboard > **WhatsApp** > **Phone Numbers**
2. Copy the **Phone Number ID** for your verified number

### 7.2 Access Token

**Option A: System User Token (recommended for production)**

1. Go to **Business Settings** > **Users** > **System Users**
2. Click **Add** to create a system user (or use an existing one)
3. Assign the system user to your app with admin role
4. Click **Generate new token** for the system user
5. Select your Meta App
6. Add the permission: `whatsapp_business_messaging`
7. Set token expiration to "Never" (recommended)
8. Copy the generated token — **store it securely, you won't see it again**

**Option B: Temporary Token (for testing only)**

1. Go to your Meta App dashboard > **WhatsApp** > **API Setup**
2. Copy the temporary access token
3. Note: This token expires after 24 hours — use it only for initial testing

### 7.3 WhatsApp Business Account ID (WABA ID)

1. Go to your Meta App dashboard > **WhatsApp** > **Phone Numbers**
2. Copy the **WhatsApp Business Account ID**

### 7.4 Meta App ID (optional but recommended)

1. Go to your Meta App dashboard
2. Copy the **App ID** from the top of the page

---

## 8. Configure the Webhook

Meta needs to send call events (ringing, accepted, rejected, ended, recording available) back to your app. This is done through a webhook.

### 8.1 Get your webhook URL

Your webhook URL is:

```
https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-call-signaling
```

Replace `YOUR_PROJECT` with your Supabase project reference (found in your Supabase dashboard URL).

### 8.2 Set up a verify token

When you configure the webhook in Meta, you need a verify token — any string you choose. Your CRM auto-generates one if you don't set it, but you can set a custom one in **Settings > WhatsApp > Verify Token**.

### 8.3 Register the webhook in Meta

1. Go to your Meta App dashboard > **WhatsApp** > **Configuration**
2. Click **Edit** under "Callback URL"
3. Enter your webhook URL from step 8.1
4. Enter your verify token from step 8.2
5. Click **Verify and Save**

   Meta will send a verification request. Your app automatically responds with the challenge value to confirm ownership.

### 8.4 Subscribe to webhook fields

After verifying the callback URL, you must subscribe to the correct fields:

1. Under the same Configuration page, find **Webhook fields**
2. Click **Manage** or **Edit**
3. Subscribe to these fields:
   - **`calls`** — receives all call events (connect, terminate, recording, transcription)
   - **`messages`** — receives call permission replies (needed for the permission flow)
4. Click **Save**

### 8.5 Verify webhook is working

Place a test call. Check your Supabase dashboard > **Edge Functions** > **whatsapp-call-signaling** logs. You should see incoming requests from Meta.

---

## 9. Enter Credentials in Your CRM

1. Log in to your CRM
2. Go to **Settings** (gear icon)
3. Select the **WhatsApp** tab
4. Enter:
   - **Phone Number ID** — from step 7.1
   - **Access Token** — from step 7.2
   - **Verify Token** — the token you used in step 8.2 (or leave blank to auto-generate)
   - **WABA ID** — from step 7.3 (optional but recommended)
   - **Connected Phone Number** — your business number in international format (e.g., `+1 555 325 0865`)
   - **Meta App ID** — from step 7.4 (optional)
5. Click **Save**

Your CRM will verify the credentials and show a confirmation. The WhatsApp chat inbox and calling features will now be available.

---

## 10. How Calling Works in This App

### Outgoing Calls (You call a contact)

1. Open a WhatsApp conversation in the CRM chat inbox
2. Click the **phone icon** next to the contact's name
3. The app checks if the contact has granted call permission
4. If permission is granted:
   - A WebRTC connection is created in your browser
   - Your microphone is accessed (browser will prompt for permission)
   - An SDP offer is sent to Meta's WhatsApp Calling API
   - Meta rings the contact's WhatsApp app
   - When the contact answers, Meta sends back an SDP answer
   - The WebRTC connection is completed and the call is connected
5. If permission is NOT granted:
   - The app sends a permission request message to the contact
   - The contact sees a message asking them to grant call permission
   - Once they grant it, you can call them again

### Incoming Calls (A contact calls you)

1. The contact initiates a WhatsApp call to your business number
2. Meta sends a webhook event to your app
3. The CRM shows an incoming call notification
4. You can accept or reject the call
5. Accepting establishes the WebRTC connection

### Call States

| State | Meaning |
|-------|---------|
| `checking_permission` | Verifying the contact has granted call permission |
| `permission_requested` | Permission request sent to the contact, waiting for their response |
| `calling` | Call is being initiated with Meta's API |
| `ringing` | Meta is ringing the contact's WhatsApp app |
| `connected` | Call is live, audio is flowing |
| `rejected` | Contact declined the call |
| `failed` | Call failed (see troubleshooting) |
| `ended` | Call was completed and ended normally |

---

## 11. Call Permission Flow

WhatsApp requires contacts to explicitly grant permission before a business can call them. This is a privacy requirement from Meta.

### How it works:

1. **First call attempt**: The app checks permission status via the Meta API
2. **No permission**: The app sends an interactive message to the contact:
   > "We would like to call you to provide support. Please grant permission so we can place a call to you."
3. **Contact grants permission**: The contact taps "Allow" in their WhatsApp app
4. **Meta sends a webhook**: The permission response is stored in the `wa_call_permissions` table
5. **Second call attempt**: Permission is now granted, the call proceeds normally

### Permission types:
- **Permanent**: The contact grants permission permanently — you can call them anytime
- **Temporary**: Permission expires after a set time (defined by Meta)
- **Revoked**: The contact can revoke permission at any time through WhatsApp settings

### Rate limits for permission requests:
- **Per 24 hours**: 1 permission request per contact
- **Per 7 days**: 2 permission requests per contact
- **Per 24 hours**: 100 calls total (across all contacts)

---

## 12. Recording and Transcription (Optional)

Your CRM supports call recording and transcription through Meta's API.

### Enable recording

When initiating a call, the app can include recording settings:

```json
{
  "recording": {
    "enabled": true,
    "purpose": "quality assurance",
    "announcementLanguage": "en_US"
  }
}
```

Meta will play an automated announcement to both parties indicating the call is being recorded.

### Enable transcription

```json
{
  "transcription": {
    "enabled": true,
    "purpose": "quality assurance",
    "announcementLanguage": "en_US"
  }
}
```

### Accessing recordings

After a call ends, Meta sends a `call_recording_available` webhook event. The recording is stored in the `wa_call_recordings` table with a media ID. You can download recordings through the CRM's call logs interface.

---

## 13. Troubleshooting

### "Business eligibility payment issue for calling" (error 131044)

**Cause**: No payment method is configured on your WhatsApp Business Account.

**Fix**: Go to Meta Business Manager > Billing > Add a payment method. Assign it to your WhatsApp Business Account. Wait up to 24 hours for it to activate.

### "Call failed" immediately after clicking call

**Cause**: Multiple possible reasons:
- Payment method missing (see above)
- Calling not enabled on the phone number (see step 5)
- Access token expired or invalid
- Phone number has spaces or special characters

**Fix**: Check the `wa_call_sessions` table in your database for the `error_code` and `error_message` fields. The CRM also shows the error in the call popup.

### "Permission denied" when trying to call

**Cause**: The contact has not granted call permission.

**Fix**: The app automatically sends a permission request. Wait for the contact to grant permission, then try calling again.

### Webhook not receiving events

**Cause**: Webhook not properly configured or subscribed to wrong fields.

**Fix**:
1. Verify the callback URL is correct (see step 8.1)
2. Verify you subscribed to the `calls` and `messages` fields (see step 8.4)
3. Check Supabase Edge Function logs for incoming requests
4. Re-verify the webhook in Meta App dashboard

### Browser microphone not working

**Cause**: Browser blocked microphone access.

**Fix**:
1. Click the lock/camera icon in your browser's address bar
2. Allow microphone access for the site
3. Refresh the page and try again

### Calls work to some numbers but not others

**Cause**: The failing numbers may not have WhatsApp, or may not have granted call permission.

**Fix**: Verify the contact has an active WhatsApp account. Send a permission request first, then try calling after they grant it.

### "User is not opted in" error

**Cause**: The contact has not messaged your business number within the last 24 hours (WhatsApp's 24-hour rule).

**Fix**: The contact must send a message to your business number first, or you must use a message template to re-open the conversation window.

---

## Quick Reference: API Endpoints Used

| Action | Meta API Endpoint | Method |
|--------|-------------------|--------|
| Check call permission | `/{phone_number_id}/call_permissions?user_wa_id={number}` | GET |
| Request call permission | `/{phone_number_id}/messages` (interactive: call_permission_request) | POST |
| Initiate a call | `/{phone_number_id}/calls` (action: connect) | POST |
| Accept incoming call | `/{phone_number_id}/calls` (action: accept) | POST |
| Pre-accept incoming call | `/{phone_number_id}/calls` (action: pre_accept) | POST |
| Reject incoming call | `/{phone_number_id}/calls` (action: reject) | POST |
| End/terminate call | `/{phone_number_id}/calls` (action: terminate) | POST |
| Get call settings | `/{phone_number_id}/settings` | GET |
| Update call settings | `/{phone_number_id}/settings` | POST |
| Download recording | `/{media_id}` | GET |

All endpoints use the base URL: `https://graph.facebook.com/v21.0`

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `whatsapp_settings` | Stores your API credentials (phone_number_id, access_token, verify_token, waba_id) |
| `wa_call_sessions` | Tracks each call's lifecycle (status, SDP offer/answer, call_id, timestamps) |
| `wa_call_permissions` | Stores permission responses from contacts |
| `wa_call_recordings` | Stores recording and transcription metadata from Meta |

---

## Checklist

- [ ] Meta Business Account created
- [ ] Meta App created with WhatsApp product
- [ ] Phone number added and verified
- [ ] Calling enabled on the phone number (step 5)
- [ ] Payment method added to WhatsApp Business Account (step 6)
- [ ] Phone Number ID copied
- [ ] Access Token generated (System User token recommended)
- [ ] WABA ID copied
- [ ] Webhook URL configured in Meta App dashboard
- [ ] Webhook subscribed to `calls` and `messages` fields
- [ ] Credentials entered in CRM Settings > WhatsApp
- [ ] Test call placed successfully

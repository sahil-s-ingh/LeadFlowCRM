/*
# Drop IB Leads and Email Inbox tables

1. Tables Removed
- `ib_leads` — Introducing Broker leads and applications. No longer used; the IB Leads page has been removed from the CRM.
- `email_inbox_conversations` — Email inbox conversations (IMAP-based email inbox feature removed).
- `email_inbox_messages` — Individual emails within conversations (cascade-deleted with conversations).

2. Why
- The IB Leads page, IMAP Configuration (Email Inbox), and Appearance & Borders settings have been removed from the frontend.
- These tables stored data only for those features and are no longer referenced by any code.

3. Safety
- Tables are dropped with IF EXISTS so the migration is idempotent.
- No other tables reference these via foreign keys (email_inbox_messages references email_inbox_conversations, which is dropped first).
*/

DROP TABLE IF EXISTS email_inbox_messages;
DROP TABLE IF EXISTS email_inbox_conversations;
DROP TABLE IF EXISTS ib_leads;

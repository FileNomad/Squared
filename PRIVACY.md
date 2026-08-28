# GroupFinance Privacy Policy

**Effective:** 28 August 2026
**Applies to:** The GroupFinance app (iOS & Android)
**Contact:** [benyellop@gmail.com](mailto:benyellop@gmail.com)

GroupFinance is a small, personal app for splitting shared expenses with people you know. This page explains, plainly, what it collects, who can see it, and what it deliberately does not do.

## 1. What is collected

Only what's needed to run a shared expense tracker between people who already know each other. There's no browsing history, location, contacts, or device tracking involved.

| Data | Where it comes from |
|---|---|
| Email address | Provided when you create an account. Used for sign-in and password recovery only. |
| Password | Never seen or stored by the app itself — handled entirely by Supabase Auth's standard hashing. See [How it's protected](#4-how-its-protected). |
| Display name | Chosen by you at sign-up. This is what other members of your events see instead of your email. |
| Events & membership | Names, descriptions, and who's in each group you create or join. |
| Transactions | Amounts, descriptions, and who owes whom, within the events you're part of. |

## 2. How it's used

Strictly to operate the app's one function: tracking who owes what within a group. That's it.

**What GroupFinance does not do:**
- No advertising, and no ad networks integrated into the app.
- No analytics or tracking SDKs — nothing profiles how you use the app.
- No selling, renting, or sharing your data with third parties for marketing.
- No real money movement — GroupFinance only records who owes whom. It never processes an actual payment.

## 3. Who can see it

Your display name and event activity are visible only to people you actually share an event with — not to every other person using the app. This isn't just a setting in the app's interface; it's enforced directly in the database, at the database level, using Postgres Row Level Security. That means the restriction holds even for a direct request to the server — it can't be bypassed by inspecting the app or its network traffic.

- **Visible to event members:** Display name, transactions, and balances within a shared event.
- **Never visible to anyone:** Your email address, password, and any event you haven't been added to.

## 4. How it's protected

- All traffic between the app and its servers is encrypted (HTTPS/TLS).
- Passwords are hashed and managed by Supabase Auth using industry-standard practices — the app never stores or has access to your plaintext password.
- Every action a signed-in account can take (confirming a debt, deleting an event, adding a member) is independently checked against Postgres Row Level Security policies on the server, not just gated in the app's interface.

## 5. Third parties

GroupFinance is built on [Supabase](https://supabase.com), which provides the database, authentication, and server infrastructure. Supabase acts as a data processor — it stores the data described above on GroupFinance's behalf, under its own [privacy policy](https://supabase.com/privacy). No other third party has access to your data.

## 6. Deleting your account

You can permanently delete your account at any time from Account settings, after re-entering your password to confirm. When you do:

- Your login is deactivated immediately — you can't sign back in, and your email is no longer tied to an active account.
- Your display name is replaced with an anonymous placeholder.
- Shared transaction history involving you is *kept*, but anonymised — so deleting your account doesn't erase other members' financial records for money you were genuinely part of. No new activity can happen under a deleted account.

## 7. Your rights

You can access, correct, or export your data by using the app directly — your events and transactions are always visible to you while your account is active. You can delete your account and its personal data at any time as described above. If you have a request this doesn't cover, contact [benyellop@gmail.com](mailto:benyellop@gmail.com) directly.

## 8. Children

GroupFinance is not directed at children and isn't intended for use by anyone under 16.

## 9. Changes to this policy

If this policy changes, the effective date at the top of this page will be updated. Material changes will be reflected here before they take effect.

## 10. Contact

Questions about this policy or your data: [benyellop@gmail.com](mailto:benyellop@gmail.com).

---

GroupFinance — a personal project, not a company. This policy describes exactly what the app does, in plain terms.

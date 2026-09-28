# Security

## Secrets

Never commit production secrets, access tokens, passwords, private keys or provider credentials.

Use environment variables for all credentials.

The repository CI runs:

```
npm run security:scan
```

## Reporting a security issue

Do not publish credentials, child data, payment data or exploitable details in a public GitHub issue.

Report the issue privately to the repository owner/administrator and rotate any potentially exposed credential immediately.

## Sensitive data

The application contains parent and child data.

Access should follow least privilege:

- owners/admins: operational access;
- coaches: only their Sessions/groups and required child context;
- parents: only their family context when parent access is enabled;
- public pages: no private client data.

## Child media

Media containing minors must not be published without approved consent.

The public media query filters non-approved child media.

## Payment data

SHARK TEAM stores payment lifecycle metadata but must not store card numbers or payment credentials.

Payment authorization is handled by Payme.

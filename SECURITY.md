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


## Dependency overrides

The repository currently carries two explicit Prisma 7 transitive security overrides:

- `deepmerge-ts: 8.0.2`
- `mysql2: 3.24.4`

They exist because Prisma 7.10.0 pins vulnerable transitive versions while the fixes are already present upstream but not yet released in the installed Prisma 7 package line.

These overrides must be re-evaluated on every Prisma upgrade.

Remove an override only after:

1. the installed Prisma dependency tree resolves to a patched version without the override;
2. `npm audit --omit=dev --audit-level=high` remains green;
3. Prisma generate, migrations, typecheck, build and the full smoke suite remain green.

Do not replace this with `npm audit fix --force` if it proposes a Prisma major downgrade.

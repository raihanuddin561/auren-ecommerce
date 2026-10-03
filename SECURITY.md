# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

- Use GitHub's private vulnerability reporting: <https://github.com/raihanuddin561/auren-ecommerce/security/advisories/new>
- The same address is published at `/.well-known/security.txt` on the site.

Include what you found, how to reproduce it, and what an attacker could do with it. We acknowledge a report within 3 working days, give a first assessment within 7 days, and keep you updated until it is fixed. Please give us reasonable time to fix a problem before you disclose it, do not access or change other people's data beyond what is needed to show the problem, and do not run denial-of-service or social-engineering tests against staff or customers.

## Scope

In scope: this repository, the production storefront and admin console, and the services configured for them. Out of scope: findings that need physical access, a rooted device, or a compromised staff account that already holds the permission being abused; missing best-practice headers with no demonstrated impact; reports from automated scanners without a working proof.

## What we do

Controls are described in `docs/architecture/ARCHITECTURE.md` section 11 and the decisions in `docs/architecture/DECISIONS.md`. Operational procedures live in `docs/runbooks/`: incident response, key rotation, database roles and CI hardening.

## Supported versions

Only the current production release (the `main` branch) receives security fixes.

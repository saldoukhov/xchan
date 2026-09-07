# Security Policy

## Reporting a vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Report privately through [GitHub security advisories](https://github.com/saldoukhov/xchan/security/advisories/new). Include the impact, affected version or commit, and steps to reproduce.

This project uses coordinated disclosure. We aim to acknowledge reports within 7 days and to ship a fix or public disclosure within 90 days.

## Scope

In scope: the relay, pairing protocol, client crypto, and the hosted instance at [xchan.dev](https://xchan.dev).

Out of scope: denial of service against the in-memory pairing queue, and issues that require the victim to skip the LifeHash / 24-word comparison.

The server is a relay. It sees pairing commits, public keys after reveal, ciphertext, and IPs. It does not store keys, channels, or message bodies.

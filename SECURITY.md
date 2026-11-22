# Security Policy

## Supported versions

Only the latest code on the `main` branch, and the live deployment built from it, receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately instead:

1. Open the repository's **Security** tab on GitHub and choose **Report a vulnerability** (private vulnerability reporting), or
2. If that option is not available, contact the maintainer, [@sarthak4836x](https://github.com/sarthak4836x), through GitHub and ask for a private channel.

Please include:

- what the problem is and where it is (file, route or page),
- steps or a request that reproduces it,
- what an attacker could do with it.

You should get a reply within 7 days. Once the problem is confirmed, a fix is made on `main` and you will be told when it is deployed. Please give us a reasonable time to fix it before you share details publicly.

## Scope

In scope: the web app, the API (`server.ts`, `server/`), the Python diagnostics core (`python/`) and the deployment configuration in this repository.

Out of scope: problems that need a stolen password or a compromised device, denial of service through sheer request volume, and issues in third-party services (Vercel, Upstash, Google) themselves.

## How the app is protected

See the **Security** section of the [README](README.md) and the threat model in [security_spec.md](security_spec.md).

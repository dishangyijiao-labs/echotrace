# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in EchoTrace, please report it responsibly:

1. **Do NOT** open a public GitHub Issue
2. Email **dishangyijiao@gmail.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive an acknowledgment within **48 hours**
4. A fix will be prioritized and released as soon as possible

## Security Design

EchoTrace is designed with privacy and security in mind:

- **Local-first**: All data processing happens on your machine. No data is sent to external servers unless you explicitly configure AI features with cloud APIs.
- **No telemetry**: No usage tracking, analytics, or phone-home behavior.
- **No accounts**: No user registration or authentication to external services.
- **Input validation**: File uploads are validated by MIME type and size (10 GB limit). Path traversal is blocked.
- **Localhost only**: The API server binds to `127.0.0.1` and is not accessible from the network.

## Scope

The following are **in scope** for security reports:

- Code execution vulnerabilities
- Path traversal / file access issues
- SQL injection
- XSS in the desktop UI
- Dependency vulnerabilities with known exploits

The following are **out of scope**:

- Issues requiring physical access to the user's machine
- Self-hosted configuration mistakes
- Vulnerabilities in upstream dependencies without a known exploit

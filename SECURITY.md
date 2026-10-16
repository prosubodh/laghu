# Security policy

## Supported versions

Only the latest minor release receives security fixes. The
published provenance attests every release build on GitHub Actions;
prefer registry installs over copying files.

| Version | Supported |
| ------- | --------- |
| 1.1.x   | yes       |
| 1.0.x   | no        |

## Reporting a vulnerability

Open a private security advisory on GitHub, or email the
maintainer through the profile listed on the repo. Include a
minimal reproduction (HTML plus state or response payload). Expect
an acknowledgement within 72 hours and a fix or mitigation plan
within 14 days. Do not open public issues for unpatched holes.

## Threat model and defaults

- `data-html` and HTML swaps pass a baseline sanitizer (scripts,
  frames, event handlers, scriptable URLs stripped). It is a
  floor: render untrusted content only behind DOMPurify via
  `Laghu.sanitize`, and serve a Content Security Policy that also
  sets `script-src-attr 'none'`.
- Attribute bindings refuse `javascript:`, `data:text/html`, and
  `vbscript:` URLs on navigation and loading attributes.
- State paths reject `__proto__`, `constructor`, and `prototype`
  segments on read and write, including inside action strings.
- Expressions never use `new Function` or `eval`, so
  `script-src 'self'` holds without `unsafe-eval`. That covers
  code injection through expressions, not XSS through HTML: those
  are separate layers, configure both.
- Fetch sends JSON with same-origin default credentials; set
  `data-headers` and CORS server-side for cross-origin APIs.

## Audits

Dependency and secret scanning run in CI. XSS and pollution
vectors from past audits live as regression tests in
`test/run.mjs` (block 7). Re-run `npm test` before every release;
the publish workflow refuses dirty trees and mismatched tags.

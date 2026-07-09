---
trigger: always_on
---

# Vibe Coding Rules — AI-Assisted Development Guardrails

> Purpose: let you move fast with AI ("vibe coding") without sacrificing correctness, security, or maintainability. Drop this file into your project (e.g. as `CLAUDE.md`, `.cursorrules`, or `AGENTS.md`) so your AI assistant follows it automatically.

---

## 0. Prime Directive

**Speed is a byproduct of correctness, not a substitute for it.** Never let "it looks like it works" replace "it is verified to work." If a rule below is skipped, say so out loud before proceeding.

---

## 1. Before Writing Any Code — System Analysis First

1. **Restate the requirement** in your own words before coding. If it's ambiguous, ask one clarifying question or state the assumption explicitly — don't silently guess on anything that changes behavior, data, or money.
2. **Identify scope boundaries**: what this change touches, what it must NOT touch.
3. **List inputs/outputs and edge cases** (empty, null, huge, malformed, concurrent, unauthorized) before implementation, not after a bug report.
4. **Check for existing solutions** in the codebase (utils, libs, patterns already in use) before writing new code. Don't reinvent what already exists.
5. **Data model / API contract first**: define shapes (types, schemas) before logic. Logic built on undefined shapes is the #1 source of vibe-coding rot.

---

## 2. Architecture & Design Principles

- **SOLID** — single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion. Don't cram unrelated logic into one function/class.
- **DRY, but not premature** — don't abstract after one use; abstract after the third repetition (Rule of Three).
- **KISS** — the simplest design that satisfies the requirement wins. No speculative abstraction layers "for future flexibility" unless the future need is real and near.
- **YAGNI** — don't build config options, plugins, or generalizations nobody asked for.
- **Separation of concerns** — UI, business logic, data access stay in distinct layers. AI-generated code tends to blur these; explicitly enforce boundaries.
- **Fail fast, fail loud** — validate inputs at boundaries; don't let bad data silently propagate.

---

## 3. AI-Specific Guardrails (the "vibe coding" traps)

1. **Never accept AI output unread.** Every generated diff gets a human skim, minimum, before commit — for logic-critical code, a line-by-line read.
2. **Small increments only.** Ask for one function/module/feature at a time, not "build the whole app." Large AI-generated dumps hide more bugs than small ones and are harder to review.
3. **Ask the AI to explain its own change** if the diff is non-trivial ("what does this do and why") — if the explanation doesn't match the code, stop and re-examine.
4. **No secrets, keys, tokens, or credentials in prompts, code, or commits.** Ever. Use environment variables / secret managers.
5. **Don't let AI touch production config, infra, or deploy scripts unsupervised.** Generate → review → apply manually, or gate behind CI.
6. **Re-verify AI-cited facts** (library APIs, version numbers, "this function exists in X package") — AI can hallucinate plausible-looking but nonexistent APIs. Check the actual docs/package before trusting.
7. **Watch for silent scope creep** — AI sometimes "helpfully" refactors unrelated code. Reject or isolate unrequested changes.
8. **Own the architecture yourself.** Use AI for implementation and drafting, but the system design decisions should be ones you understand and could defend, not ones you accepted because they compiled.

---

## 4. Coding Standards

- Consistent naming, formatting, and style — enforce with a linter/formatter (ESLint/Prettier, Black/Ruff, etc.), not manual review.
- Functions should do one thing; if you can't name it without "and," split it.
- No magic numbers/strings — name constants.
- Comments explain **why**, not what (the code already shows what).
- Prefer explicit over clever. If a teammate (or future you) needs 5 minutes to parse a line, simplify it.

---

## 5. Security Rules (non-negotiable)

- Validate and sanitize **all** external input (user input, API responses, file uploads, query params).
- Use parameterized queries — never string-concatenate SQL.
- Apply the principle of least privilege for every credential, API key, and role.
- Never trust client-side validation alone — re-validate server-side.
- Escape output to prevent XSS; use CSRF protection on state-changing endpoints.
- Keep dependencies patched; check for known CVEs before adding a new package.
- No `eval`/dynamic code execution on untrusted input.
- Log security-relevant events (auth failures, permission denials) — but never log secrets or PII in plaintext.

---

## 6. Testing — Non-Optional

1. **Write tests for the behavior, not the implementation.** Tests should survive a refactor.
2. Minimum bar before merging:
   - Happy path covered.
   - At least the top 2–3 edge/error cases covered.
   - Regression test added for every bug fix (so it can't silently return).
3. Run the full test suite before every commit that touches shared code — don't rely on "it worked when I tried it once."
4. For AI-generated code specifically: **ask the AI to generate tests separately from the implementation**, ideally in a separate pass, so it isn't just validating its own blind spots.
5. Manual smoke test for anything touching UI, payments, auth, or data deletion — automated tests don't catch everything a human eye does.

---

## 7. Error Handling & Logging

- Never swallow exceptions silently (`catch {}` with nothing in it is a bug).
- Fail with actionable error messages — include context (what operation, what input) not just "something went wrong."
- Distinguish expected errors (validation failures, 404s) from unexpected ones (crashes) in how they're logged/alerted.
- Add structured logging at key boundaries (API entry/exit, external calls, state changes) — enough to reconstruct what happened without flooding logs with noise.
- Have a plan for what happens on partial failure (network drop mid-write, timeout mid-transaction) — don't leave data in an inconsistent state.

---

## 8. Version Control & Change Management

- Small, atomic commits with descriptive messages — one logical change per commit.
- Never commit directly to `main`/`production` branch for anything beyond trivial fixes — use branches + review, even if reviewing your own AI-assisted diff.
- Write a commit message that explains **why**, referencing the requirement/ticket if one exists.
- Before merging: diff review, tests green, no leftover debug code (`console.log`, commented-out blocks, TODO stubs left unresolved).
- Tag/document breaking changes explicitly.

---

## 9. Documentation

- Every non-trivial module gets a short header comment: purpose, inputs/outputs, gotchas.
- Keep a running `CHANGELOG` or equivalent for anything shipped to users.
- Document assumptions and known limitations — especially ones the AI or you made under time pressure. Undocumented assumptions are where "mishaps" actually come from.
- README should let a new contributor (human or AI) run the project from zero without asking you anything.

---

## 10. Performance & Scalability (proportional effort)

- Don't optimize prematurely — but don't ignore obvious O(n²) traps, N+1 queries, or unbounded loops either.
- Set explicit limits (pagination, timeouts, max payload size) on anything that touches external input or growing data.
- Profile before optimizing; don't guess at bottlenecks.

---

## 11. Deployment & CI/CD

- Nothing reaches production without passing: lint → tests → build → (staging check, if available).
- Environment parity: config differences between dev/staging/prod should be limited to env vars, not code branches.
- Have a rollback plan before you ship, not after something breaks.
- Feature-flag risky changes where possible rather than big-bang releases.

---

## 12. Pre-Ship Checklist (run this before calling anything "done")

- [ ] Requirement re-read against final implementation — does it actually do what was asked?
- [ ] Edge cases and error paths tested, not just the happy path.
- [ ] No secrets, debug code, or unrelated changes in the diff.
- [ ] Security basics checked (input validation, auth/authz, no injection vectors).
- [ ] Tests written and passing; regression test added if this was a bug fix.
- [ ] Logging/error handling present for failure modes.
- [ ] Documentation/comments updated if behavior or interfaces changed.
- [ ] Rollback/mitigation plan exists if this touches production.
- [ ] You can explain every part of the change — if you can't, re-review before shipping.

---

### The one-line summary
**Move fast, but never faster than you can verify — every AI suggestion is a draft, not a delivery.**
# #73 — IMPLEMENTED — NOT TESTED / AWAITING QA

## Root cause and design

The existing account revision and catalog TTL commit (76f167e) is preserved. Connection inference still lacked account/model lifetime cancellation. A completer captured a credential before settings could revoke it. The consent sample was not the actual outbound request. Fetch timers expired at response headers, leaving the body unbounded. Remote error bodies could echo private content. Async vault work could complete after lock/delete.

The implementation binds requests and connection status to the current credential revision and model, cancels on revocation, keeps body reads under timeout, and asks approval of the exact serialized body for each generation. No headers/keys enter the consent store. The native modal lives over the editor/settings and queued requests disappear on cancellation. A full catalog is required; incomplete pagination cannot remove an otherwise valid selection. Vault operations use an epoch and ciphertext snapshot before committing async results. Another tab changing the vault locks this tab.

## Changed files

- `src/ai/credentials/keys.ts`: credential lifecycle subscriptions, immediate revocation and stale vault-operation protection.
- `src/ai/providers/client.ts`: cancellation, full-body timeout, bounded pagination, safe errors and approval hook.
- `src/ai/providers/consent.ts`: transient request-specific approval queue without secrets.
- `src/app/AiOptions.tsx`: guard captured completers against current settings and credentials.
- `src/app/settings/AiSection.tsx`: abort stale checks and show truthful status.
- `src/app/settings/OutboundConsent.tsx`, `settings.css`, `src/app/App.tsx`, `src/app/Dialog.tsx`: exact-body modal, focus and overlay integration.
- `src/core/errors.ts`, `docs/erros.md`, version manifests and changelog.

## QA instructions (not executed)

1. In Brave, use synthetic provider responses first. With a project open, authorize an editorial request and compare the complete preview with the sent request body, including examples, system text, transcript and any repair. Cancel another request and confirm zero transmission and preserved edits.
2. Start a slow connection check with account A. Replace/remove its key, change model, lock/delete vault, switch settings sections and revoke permission. Resolve A's delayed response. No old status, model, secret or response may reappear; no further repair may use A.
3. Delay response body after headers. Confirm timeout/cancel covers that phase. Exercise 401/403/402/429, echoed secrets/private text, empty output, malformed JSON and incomplete/repeated pagination. Error copy must expose no response body or secret.
4. Delay Web Crypto completion while locking, deleting, replacing or changing the vault in another tab. No stale write/unlock may restore a deleted credential. Exercise storage failures and incorrect password; projects/media must remain untouched.
5. Close/reload the tab. Session keys and pending payloads must be gone; encrypted vault opens only with its password. Check no key appears in localStorage outside ciphertext, project/export/history, URL or diagnostic text.
6. Confirm settings and consent dialogs handle keyboard focus, Tab, Escape, narrow windows and return to the unchanged editor. Then run appropriate independent regression checks and real provider/browser CORS checks with QA-owned restricted credentials.

## Remaining work and boundaries

Issue #73 stays open. Per-task/per-project selection, usage budgets and routing are shared implementation scope with #9. Optional Mistral/HF/localhost adapters must wait for a separate browser feasibility audit; do not invent support. Real provider entitlement/CORS, security review and production behavior require QA. No test, build, typecheck, lint, validation, app opening, provider API request or Actions dispatch was performed for this increment. Previous-agent evidence in older commits does not verify this increment.

Cancelling a fetch cannot undo a request already received/billed by the provider. This is disclosed as a limitation; the app prevents further sends, not a provider-side billing guarantee.

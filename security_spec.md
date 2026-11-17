# Security Specification: Aurelius Orchestrator

## 1. Data Invariants
- A user can only read, create, update, or delete their own profile at `/users/{userId}` when authenticated with a verified email (`request.auth.uid == userId`).
- All nested user collections (`threads`, `messages`, `agentic_memory`, `artifacts`, `audit_ledger`) enforce strict path-ownership and parent/field identity integrity (`userId == userId == request.auth.uid`), with zero synthetic guest bypasses (`'0'`, `'guest-*'`).
- Document IDs must match `^[a-zA-Z0-9_\-]+$` and length `1..128` on single-document operations (`get`, `create`, `update`, `delete`).
- Every string field enforces explicit upper bounds (`id <= 128`, `title <= 256`, `prompt <= 4000`, `content <= 50000`, `mediaUrl <= 500000`) and strict enum domains (`UserProfile.role`, `ChatMessage.role`, `AgenticMemory.role`, `Artifact.type`, `AuditLedgerItem.status`).
- Immutable ownership & creation fields (`uid`, `userId`, `createdAt`, `threadId`) cannot be mutated after document creation.
- Self-privilege escalation is blocked: standard users cannot create or update their `role` to `'admin'`.

## 2. Attack Vectors & Defensive Gates ("Dirty Dozen" Protections)
1. **Unauthenticated Read/Write**: Rejected by `isSignedIn()` + catch-all deny `match /{document=**} { allow read, write: if false; }`.
2. **Email Spoofing (`email_verified == false`)**: `isSignedIn()` and `isAdmin()` explicitly require `request.auth.token.email_verified == true`.
3. **Synthetic Guest / Path Traversal (`uid == '0'` or `/users/{userIdB}`)**: Rejected because `isOwner(userId)` strictly enforces `request.auth.uid == userId`.
4. **Shadow Field Injection**: Blocked on create via `keys().hasAll(...) && keys().hasOnly(...)` and on update via `diff(existing()).affectedKeys().hasOnly(...)`.
5. **Document ID Poisoning**: Guarded on `get`, `create`, `update`, `delete` using `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
6. **Self-Role Privilege Escalation**: Users cannot write `role: 'admin'` unless verified `isAdmin()`, and cannot alter `role` via update.
7. **Denial-of-Wallet / Large Buffer DoS**: Strict `.size()` limits enforced on every string field; zero `get()`/`exists()` inside `allow list`.
8. **Cross-Tenant Query Scraping**: Every `allow list` verifies `resource.data.userId == request.auth.uid` (or `resource.data.uid == request.auth.uid`) directly without client delegation.
9. **Type & Enum Poisoning**: Strictly validates field types (`is string`) and finite enum sets (`in ['user', 'admin']`, `in ['SUCCESS', 'FAILED', 'HEALED']`, etc.).
10. **Immutable Field Overwrite (`createdAt`, `userId`, `threadId`)**: Verified unchanged during `update` (`incoming().createdAt == existing().createdAt`).
11. **Public Read/Write Probe Abuse**: `/test/connection` restricted to authenticated `allow get: if request.auth != null;` with `allow list, write: if false;`.
12. **Client Security Delegation / Secret Exposure**: Server-side AES-256-GCM vault manages credentials (`data/.secrets.vault.enc`), never stored in Firestore or client state.

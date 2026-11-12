# Account lifecycle

## Verified locally on 2026-11-12

- Email verification has a dedicated hashed, expiring, single-use token table.
- Authenticated requests use the account email, never a caller-supplied recipient.
- Requests are limited to one per minute and five per hour under a user row lock.
- Confirmation checks current account state and unchanged email; concurrent confirmations consume once.
- Queue envelopes use the existing authenticated encryption, worker retries and idempotency keys.
- Settings request a link; `/verify-email/` clears the fragment before confirmation and never claims success after a failed request.
- `EMAIL_VERIFICATION_ENABLED` defaults to false. No real email was sent.
- Account deletion requires the current password and a valid session. A user lock protects the transactional recheck of client and owner requests across five request models. Request creation takes a conflicting shared lock; if the account is being modified it returns a retryable conflict instead of waiting behind a listing lock.
- Requests in new, pending, accepted or requires_more_info state block deletion, even after their dates pass. Requests made as a guest without an account ID are not attributed to an account by comparing unverified contact fields.
- Deletion withdraws owned listings, hides public assets, removes personal profile fields, preferences, saved searches and credentials, and disables hotel partner integrations. Administrative accounts cannot self-delete. Request and message history, audit records and storage binaries are not physically erased by this action.
- Business email events are queued with a stable event/recipient ID and no message body or moderation reason. The sender requires a current, verified address and explicit user opt-in, both on enqueue and on delivery. Optional templates: `business.message`, `business.request_status`, `business.listing_decision`, each with `{{url}}`.

## Tests actually executed

- 28 targeted tests passed, covering verification, recovery, deletion, account lock contention and delivery/opt-out with a substitute transport. The broader run passed 581 backend tests; 5 skipped and 6 legacy suites requiring production cluster identity were excluded after their safety checks refused to run.
- Browser verification, deletion and opt-in passed at 360 and 1440 pixels with a controlled API.
- NestJS build, TypeScript, Prisma validation and database schema comparison passed.
- Both additive migrations were applied only on loopback PostgreSQL `pencmi_step15_test`; no schema difference remains.

## Production backup rehearsal

- On 2026-11-12, a new encrypted PostgreSQL archive was exported from the verified Railway production database service. DPAPI readback and SHA-256 were checked before restoration into a new loopback-only PostgreSQL database with a different cluster identity.
- Both migrations applied cleanly on the restored copy. The fingerprint of pre-existing data matched across 60 tables, excluding migration history and the new table and preference column. Prisma schema diff was empty.
- The alert integration fixture uses unique search criteria so real listings present in the restored copy cannot invalidate assertions about fixture-only matches.

## Rollout

- Before pushing to main, verify the production target, restore a current backup to an isolated cluster and apply both migrations there. Railway runs Prisma migrations before starting the new API.
- Deploy the frontend alongside the API so `/verify-email/` and the account settings match the new endpoints.
- Leave `EMAIL_VERIFICATION_ENABLED` and `BUSINESS_EMAILS_ENABLED` false on API and worker until a verified sender, production frontend origin, shared queue encryption key and tested worker are in place. Do not start production deliveries as part of migration testing.
- For old manual or guest requests not linked to an account, and for physical retention/purge of historical data, follow the applicable operational policy; these changes do not infer identities or purge third-party records.

## Environment constraint

C: had about 144 MB free during these checks. Several Node processes exhausted memory. Preserve project data, uploads and backups; restore disk headroom before the full validation and release.

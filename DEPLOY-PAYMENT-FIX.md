# Payment integrity and reporting update

## Deployment order

This branch requires a database migration. Do not deploy the application first.

1. Back up the Supabase database and test against a staging copy.
2. Apply `migration_payment_integrity.sql` using the Supabase SQL editor or a privileged PostgreSQL connection. The script is transactional and can be rerun.
3. Deploy the application from this branch.
4. Confirm login for an administrator and a student, submit a test slip, approve it twice, and check that one transfer produces one set of allocations and one income for a special slip.

The local environment has Supabase API credentials, but no SQL connection or management credential. The migration has been tested in an isolated PostgreSQL runtime (PGlite), **not applied to the hosted database**. Git publication is on `fix/payment-integrity-and-reporting` so `main` does not deploy code against an unmigrated database.

The migration revokes authenticated client writes to payments and the special collection tables. Deploy the updated API and UI together; older browser bundles that write these tables directly will be rejected. Existing application SQL reset routines and any external integrations should be checked against the new income-to-slip foreign key.

## Behavior changed

- Regular and combined payments save in one transaction, including the no-QR/manual-review path. A stale or already paid allocation aborts the whole batch.
- Special slip approval locks records, creates its linked income once, and rolls everything back on failure. Repeating an approval returns the current result. Rejected or approved special slips cannot be silently changed into another final state.
- Transfer references and file hashes are checked across both payment systems inside the database. Reusing a rejected main reference is blocked while another active allocation still uses it.
- Cash rejects invalid/negative/overprecision amounts and closes pending credits in the same transaction. An existing pending slip must be reviewed/rejected before replacing it with cash.
- Approvals preserve the recorded payment amount instead of recomputing it using today's Tier settings. Rejection keeps the shared slip image.
- Credit auto-approval requires complete provider evidence and a pending credit for that particular allocation. Unverified slips remain pending.
- The server decodes the actual uploaded image; client QR text cannot substitute a different transfer. Provider and LINE requests have bounded timeouts. LINE work runs after commit/response.
- PromptPay validates phone/tax-ID inputs, encodes the appropriate identifier type, and validates money. Reference checked: [promptpay-qr implementation](https://github.com/dtinth/promptpay-qr/blob/master/index.js). Actual bank-app scanning is still a deployment smoke test.
- Shared satang rounding fixes browser/server amount comparison. Flat fine descriptions use the same rate as calculation. The existing per-period fine remains one charge for that overdue period and is labeled explicitly.
- Monthly buckets use Thailand time and day 1, and payment filtering uses the same approval date as chart grouping. Dashboard payment queries are batched; financial lists explicitly page past API row caps.
- Income/expense reports and exports filter the same semester. New records receive the active semester. Historical records without a semester remain unassigned and are shown as a report warning.
- Payment rate chart counts are installment records, not distinct people. Historical target/rate calculations are explicitly labeled as using current student/Tier information.

## Historical data and limitations

This change prevents new inconsistencies; it cannot infer the correct history of already duplicated income, paid totals, or missing allocations. Reconcile those with bank evidence before closing accounts. Historical `semester_id` values should be assigned from known records, not guessed from creation dates. Student membership/Tier snapshots for historical targets are not backfilled.

`after()` removes LINE latency from the payment response but is not a durable notification queue. A failed notification can still need a retry. The migration uses a short transaction-wide advisory lock for financial writes; load-test before scaling beyond the classroom workload.

The migration covers payment/special-collection integrity and special-collection access. It is not a complete audit of all authentication, account-binding, expense, or administrative-reset endpoints.

## Validation

- `npm test`: 20 passing tests, including real PostgreSQL transaction rollback, idempotency, RLS ownership, cross-system duplicates, credit closure, fine boundaries, money, PromptPay fields, month boundaries, pagination, and profile metadata isolation.
- `npm run build`: production build and TypeScript check pass.
- ESLint: 287 existing errors and 58 warnings remain (baseline: 301 errors and 70 warnings). No new diagnostic categories/messages were introduced in the comparison. New core modules and rewritten payment routes are linted separately before publication.
- Database tests use a single embedded connection; they verify locking SQL and sequential retry behavior, not production multi-connection throughput. No real payments, LINE messages, or hosted database mutations were made.

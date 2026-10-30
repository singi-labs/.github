# Sifa Records: Lexicon Fields, Writes and Ingestion

Rules for designing `id.sifa.*` lexicon fields and for writing, indexing and reading Sifa records. Builds on [atproto-conventions.md](atproto-conventions.md), which covers generic lexicon authoring (file structure, field types, string formats, record keys, strongRef, length limits, timestamps). This file covers what is specific to Sifa: how fields evolve, how the API writes, how ingestion reads, and how a change is released.

**When to consult this file:** before adding or changing a lexicon field or record type, a write route, an indexer, or a validation schema in sifa-lexicons, sifa-sdk, sifa-api or sifa-web.

---

## 0. The core rule

**A record that is valid against the published `id.sifa.*` lexicon is always shown by Sifa, whichever client wrote it.**

Sifa authors these lexicons. Other apps, AI agents, scripts and direct PDS writes rely on them as a public contract, and Sifa cannot tell which client wrote a record.

- Ingestion validates against the lexicon and nothing stricter. Only lexicon-invalid records are rejected, and every rejection is logged and counted.
- Sifa's own forms and write routes may ask for stricter input, case by case (for example, an alpha-2 country on a location). These rules make Sifa's own writes cleaner. They never decide whether someone else's record is shown.
- Rules that Sifa needs for correct display (organization linking, location normalisation, one primary entry, dangling references) run at index or render time, so they apply to every writer.
- A constraint that Sifa truly needs goes into the lexicon, at design time. Tightening a published lexicon breaks records that already exist.
- Moderation, takedowns, account state, visibility settings and consent gates still apply. This rule is about validity only.

---

## 1. Designing lexicon fields

### Evolution

- **Additive only.** New fields are optional. Never remove, rename or retype a published field. An additive change is a patch release.
- **Settle the name before publishing.** Renaming after publish is a breaking change. Review the name in the PR that introduces the field.
- **Keep an imperfect name rather than rename it.** Document the wider meaning in the `description` instead.
- **Prefer a new collection over overloading an old one.** Read both during the transition and migrate on the next edit. Do not run a mass migration.
- **No clean-cut renames.** Records written under an old shape stay in user repositories forever, so ingestion keeps reading them (see section 3).

### Shapes and values

- **`knownValues`, never `enum`**, with full tokens (`id.sifa.defs#...`), so other writers can add values and Sifa can render unknown ones as a fallback.
- **Partial dates** (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`) are plain strings, not `format: datetime`. `createdAt` stays `format: datetime`.
- **Shared nested shapes live in `id.sifa.defs`** (for example `agentRef`: `name` + `did` + `entityRef`). The `name` is a snapshot at write time. The `did` and `entityRef` are the identity.
- **References to records that get edited** use an at-uri or `externalRecordRef` with an optional CID. A pinned strongRef CID goes stale on every edit. Use a strongRef only when the exact version matters, for example for a confirmation.
- **Lengths:** `maxGraphemes` plus `maxLength` at about 1:10. Where a field overlaps with `app.bsky.actor.profile`, copy its limits.
- **`isPrimary`** is a boolean on the record. Leave it out where it makes no sense.
- **Data the user owns belongs in their repository.** Profile overrides such as display name, avatar and pronouns live in `profile.self`. Database columns are a read model rebuilt from records.

### Descriptions

The schema cannot express everything a writer needs. The `description` of the record or field states:

- update semantics: read the current record and merge into it
- set rules: one primary entry per section, the maximum number of records in a collection
- how to reference an organization or other entity
- what Sifa does with the field

---

## 2. Writing records (sifa-api write routes, sifa-sdk `/atproto`)

### Building the record

- **`createdAt`:** set it on create. On update, keep the value of the existing record (`buildRecordWithPreservedCreatedAt`).
- **Read, then merge.** An update replaces the whole record. Read it first with `getPdsRecord`, then build the new record. Fields the form does not handle are carried over: either list them in `PRESERVED_FIELDS_ON_UPDATE` (kept in step with the lexicon by a test) or spread-merge the existing record. A field the form clears is removed explicitly (`omitClearedFields`).
- **Never drop unknown fields.** Other writers may have added fields Sifa does not know. Write schemas use `.passthrough()`, not `.strict()`. A test asserts that each new field survives parsing.
- **Write-side validation must match the lexicon limits**, or be stricter on purpose and documented. It must never accept a value the lexicon forbids. Limits count graphemes and UTF-8 bytes, not string length. Before the write, check the assembled record (request body plus carried-over fields) against the vendored lexicon with `lexiconRecordIssue`, and return a 400 at the failing field's path. A stored value over the limit blocks the save until the user shortens it.
- **Enrichment on write** (for example `agentRef`, company DID): diff before writing to avoid needless commits. Only use bindings Sifa already has; do not resolve over the network on the write path. The same enrichment must also exist at index time (section 3).
- **Blobs:** upload first, then write the reference. Do not leave a stranded blob when the record write fails.

### Sending the write

- `writeToUserPds` sends `applyWrites` with `validate: false`: the PDS does not know Sifa's lexicons. Sifa's own validation is the only check before the write.
- **Batch related operations** in one `applyWrites`. Setting a primary clears `isPrimary` on every other record of that section that claims it, in the same batch (`collectOtherPrimaryClaimOps`), not only on the previous primary.
- Retries are safe because operations are keyed by record key.

### Write-through and the Jetstream echo

- **Order:** write to the PDS first, then index into the database right away (`indexRecord`), so the user sees the change immediately. The Jetstream event for the same record arrives later and upserts it again.
- Both paths are last-writer-wins upserts keyed on `(did, rkey)`. Nothing orders write-through against Jetstream, and a replay after a restart can briefly re-apply an older version. So **every derived or enriched column must be idempotent and must never downgrade data**.
- A write-through re-index must not wipe data that only the Jetstream path provides, such as the CID.

### Deletes

- Delete on the PDS first, then locally. A not-found error from the PDS still deletes locally.
- Delete derived rows (entity links, claims, skill links). Never delete other people's records, such as confirmations.
- Deleting `profile.self` clears its columns but keeps the profile row.
- Cascades that change other records (for example removing a deleted skill from positions) go in the same `applyWrites`. Ingestion must also tolerate the case where another writer did not cascade (section 3).
- Never use `pdsRecordExists` to verify anything; it turns every error into "not found". Use `getPdsRecord`.

---

## 3. Ingesting and reading records (sifa-api indexers)

- **Validate against the lexicon only** (section 0). Check one field on its own when only that field is used (for example `entityRef`). Do not let one bad optional field drop the whole record.
- **Read every shape that was ever published**, with a clear precedence, in one shared helper that the Jetstream indexer, write-through and sync all use. Examples: nested `agentRef` over flat company fields; `locality`/`country` over `city`/`countryCode`; `startedAt` over `startDate`. API responses keep returning the old field names until no consumer reads them.
- **Derive at index time, keep the raw data:** geocoding, country pairs, organization links, ignoring references that no longer resolve.
- **One primary per section, picked at read time.** Several records can claim `isPrimary`. The database keeps each record's own flag, and every read applies the same rule: the newest `createdAt` wins, a tie goes to the highest rkey in code-unit order (`COLLATE "C"`). A position, involvement or project with an end date never wins (`isOngoingRecord`). Use `pickPrimaryRkey` in TypeScript and `PRIMARY_WINNER_ORDER` in SQL, so both give the same winner. Never take `limit(1)` without this ordering.
- **Do not change lexicon-valid text on ingest.** Store it as written and escape it when rendering. Sanitising on ingest can change or empty a valid value (for example a title containing `<T>`).
- **Guard every parse**, `createdAt` included. A value that throws must not drop the record or stop the indexer.
- **Upserts are idempotent**, keyed on `(did, rkey)`. Jetstream replays from its cursor after a restart.
- **CIDs** are stored for collections that others confirm, because a confirmation points at an exact version.
- **Sync and backfill page through all records** with the cursor (`listAllPdsRecords`), never stopping at the first page. Sync and reconcile index through the same indexers as Jetstream, from one collection table (`SYNC_COLLECTIONS`).
- **Feed cards** come from the SDK view model (`toStreamCardVM`). Test a new record type by running a real record through it.

---

## 4. Releasing a change

1. **sifa-lexicons:** change the JSON, run `npm run generate`, merge. **Merging does not publish the schema.** The publish workflow writes `com.atproto.lexicon.schema` records to the lexicon authority account, and it can fail silently when its token expires. Check the published record on the PDS afterwards.
2. **Permission sets** (`id.sifa.auth*`): when a collection is added, add it to the matching permission set.
3. **sifa-sdk:** types, Zod schemas (matching the lexicon limits, `.passthrough()`), changeset, publish.
4. **sifa-api:** refresh `src/lexicons/` from sifa-lexicons `origin/main` with `scripts/vendor-lexicons.sh` (never edit by hand). The ingest gate and the write routes validate against these files. The lexicon conformance test must pass without exemptions: database columns are named like the lexicon field. Add the field to the Drizzle schema with a generated migration, the indexer (insert and conflict update), write-through, sync and the profile view responses.
5. **sifa-web:** bump the SDK pin in both `dependencies` and `pnpm.overrides`.
6. **Deploy order:** lexicons and SDK, then sifa-api, then sifa-web.

### Checklist for a new field

- [ ] Optional, name reviewed, `knownValues` instead of `enum`, limits in graphemes and bytes
- [ ] Description states the semantics a third-party writer needs
- [ ] A minimal lexicon-valid record with the field is indexed and shown (test)
- [ ] Write schemas match the lexicon limits and keep unknown fields
- [ ] Updates keep the field when the form does not send it
- [ ] Indexer reads old and new shapes; enrichment also runs at index time
- [ ] Schema record published and checked on the PDS
- [ ] Permission set updated if a collection was added

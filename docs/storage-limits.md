# Storage limits & scaling

JSON admin stores each resource in a **single file**. That model is simple and Git-friendly, but it imposes hard upper bounds — especially when the storage backend is the GitHub Contents API. Read this page **before** picking the `array` kind for anything that will grow.

---

## GitHub limits at a glance

| Limit | Value | Source |
|-------|-------|--------|
| **Inline content in Contents API response** | **1 MB** per file | GitHub returns `encoding: "none"` and omits `content` above this. JSON admin falls back to the **Git Blobs API** automatically. |
| **Blobs API content size** | **100 MB** | Hard ceiling. Reads of larger files fail. |
| **Recommended repo file size** | **50 MB** | GitHub warns above this and rejects pushes above 100 MB through normal Git. |
| **Per-write API call** | 1 commit per save | Each save is `read → merge → write`, which means one commit on every CRUD action. |
| **Authenticated rate limit** | 5,000 req/hr (PAT) | Shared across all readers and writers using the same token. |

Files between 1 MB and 100 MB still work — JSON admin transparently reads them via the Blobs API — but they pay a second round-trip on every read and the full blob is held in memory while it is base64-decoded.

---

## Sizing table (single-file `array` mode)

Approximate row count where you should start worrying. Numbers assume modest rows with short string fields and one or two relations; rich-text or embedded media drives the row size up fast.

| Avg. row size | Comfortable (<256 KB) | Slow but works (1–10 MB) | Approaching ceiling (>50 MB) |
|---------------|----------------------:|-------------------------:|-----------------------------:|
| 500 B  | < 500 rows  | ~ 2k–20k rows | ~ 100k rows |
| 2 KB   | < 130 rows  | ~ 500–5k rows | ~ 25k rows |
| 10 KB  | < 25 rows   | ~ 100–1k rows | ~ 5k rows |
| 50 KB (rich text) | < 5 rows | ~ 20–200 rows | ~ 1k rows |

Treat the **"Comfortable"** column as a soft target. Above it, every save rewrites the whole file and every read transfers the whole file.

---

## Write amplification

Every CRUD action on an `array` resource is:

1. `GET` the entire file (1 round trip, or 2 if it exceeds 1 MB).
2. Parse it, mutate one row in memory.
3. `PUT` the entire file with the new contents (1 commit).

Implications:

- **A 10 MB array file pays 10 MB of read + 10 MB of write to flip a single boolean.**
- **Concurrent edits collide.** The server uses GitHub's blob `sha` for optimistic concurrency and retries **once** on 409 conflict. Heavy editing by multiple users on the same large file will surface 409s to the UI.
- **Commit history grows fast.** A 500-row file edited 50 times a day produces 50 commits per day against the same path.

---

## When `array` becomes a problem

Move off single-file `array` storage when **any** of these are true:

- File size in repo exceeds **~1 MB** (you're now on the Blobs API fallback path, with extra latency and memory cost).
- More than ~2 concurrent editors regularly touch the same resource.
- Row count exceeds a few hundred and rows are individually large (rich text, base64 images, long arrays).
- You need partial reads, search, sort, or filter pushdown — JSON admin always loads the whole array.
- You need an audit trail finer than "the commit that touched this file".

For those workloads, use **Drizzle admin** with a real database. JSON admin is for **configuration and small editorial lists**, not user-generated content at scale.

---

## When `object` mode is fine

`object` resources are bounded by your schema, not by row count. Site settings, feature flags, and similar config files stay well under any limit. They have the same write-amplification on save, but the file is small so it doesn't matter.

---

## Mitigations short of switching backends

If you must stay on GitHub storage with a growing `array`:

- **Split by domain.** Register multiple `array` resources backed by separate files (`content/banners-home.json`, `content/banners-marketing.json`) instead of one mega-file.
- **Trim historical rows.** Move closed/archived rows out of the live file.
- **Avoid storing media inline.** Reference S3/R2 URLs instead of base64-encoded blobs.
- **Cache reads at the edge** for public consumers. JSON admin only owns the editing path; downstream readers don't have to go through it.

---

## Error surfaces tied to these limits

See [error-reference.md](./error-reference.md) for the full catalog. The ones most often caused by size:

- **502** "GitHub Blobs API error (…)" — fallback failed; the file is likely over 100 MB or the token lacks `contents:read`.
- **500** "GitHub Blobs API response is missing base64 content." — unexpected encoding from the Blobs API; usually a corrupted upload or non-blob object.
- **409** "GitHub file changed on the server (sha conflict). Refresh and try again." — concurrent edit beat your save; the server already retried once.
- **422** "File is not valid JSON." — the file was edited outside JSON admin and broke parse. Fix the file directly in the repo.

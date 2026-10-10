# cms-strapi — System Under Test (QA Portfolio)

Strapi 5 CMS yang di-setup sebagai **System Under Test** untuk automation suite Selenium Java
(repo terpisah: `cms-automation`). Semua konfigurasi via code — content types, roles,
permissions, dan seed data dibuat otomatis saat startup.

## Stack

- Strapi **5.50.0** (pinned) · Node.js 20+ · TypeScript
- PostgreSQL 16 via Docker Compose (host port **5433**)

## Quick start

```bash
docker compose up -d --wait   # PostgreSQL
npm install
npm run develop               # http://localhost:1337/admin
```

Full Docker (Strapi + Postgres dalam container):

```bash
docker compose --profile full up -d --build
```

## Credentials (seeded)

| Email | Password | Role |
|---|---|---|
| admin@example.com | Admin123! | Super Admin |
| editor@example.com | Editor123! | Editor |
| author1@example.com | Author123! | Author |
| author2@example.com | Author123! | Author |

## Seed data

Dibuat oleh `src/bootstrap.ts` saat startup (idempotent — re-run tanpa duplikat):

- **5 categories** — Technology, Design, Business, Science, Lifestyle
- **12 articles** — 9 published + 3 draft, tersebar antar author & category
- **3 pages** — About, Contact, Privacy Policy (published)
- **5 media** — placeholder images (Lorem Picsum; fallback PNG kalau offline)

## RBAC

| Role | Content CRUD | Publish | Manage users | Media |
|---|---|---|---|---|
| Super Admin | All | ✅ | ✅ | Full |
| Editor | All | ✅ | ❌ | Full |
| Author | Own only (`is-creator`) | ❌ | ❌ | Upload + own only |

## Content types

- **Article** — title (unique, min 5), slug (UID), body (blocks), excerpt (max 300), category (m2o), coverImage (image), author (admin user), draft/publish
- **Category** — name (unique), slug (UID), description
- **Page** — title, slug (UID), content (blocks), draft/publish

## Rules

Lihat `CLAUDE.md`. Intinya: jangan kustomisasi admin UI, jangan upgrade Strapi,
jangan tambah content type — locator Selenium harus stabil.

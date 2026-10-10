# QA Handoff — cms-strapi (SUT)

SUT adalah **cms-strapi**, sebuah CMS Strapi 5 yang dikonfigurasi sepenuhnya via code (content types, roles, permissions, seed data). Automation dikerjakan pakai **Selenium** di repo terpisah (`cms-automation`) yang men-drive admin panel dan opsional REST API.

## 1. At a glance

| Item | Nilai |
|---|---|
| Platform | Web admin panel (React SPA) |
| Framework | Strapi 5.50.0 (pinned) + Node.js 20 + PostgreSQL 16 (Docker) + config TypeScript |
| Admin URL | http://localhost:1337/admin |
| API URL | http://localhost:1337/api |
| Auth | Strapi admin login (email + password) |
| Automation target | Selenium (repo terpisah `cms-automation`) |
| Quality gate | `npm run build` (`strapi build`) hijau — **tidak ada** script lint/type-check (by design) |

## 2. Cara menjalankan

```bash
docker compose up -d --wait     # PostgreSQL 16 (Docker)
cp .env.example .env            # lalu isi secrets (lihat catatan di bawah)
npm install
npm run develop                 # http://localhost:1337/admin
```

- Secrets di `.env` (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`) semuanya `tobemodified` di template — generate sendiri:
  `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"`.
- Env DB yang wajib: `DATABASE_CLIENT=postgres`, `DATABASE_HOST=localhost`, `DATABASE_PORT=5433`, `DATABASE_NAME=strapi`, `DATABASE_USERNAME=strapi`, `DATABASE_PASSWORD=strapi`, `DATABASE_SSL=false`.
- **Seed jalan otomatis saat bootstrap** (`src/index.ts` → `src/bootstrap.ts`) di run pertama `develop`/`start`. Tidak perlu perintah seed manual.
- Alternatif full Docker (Strapi + Postgres dalam container): `docker compose --profile full up -d --build` (mengaktifkan service `strapi` di profile `full`).

## 3. Kredensial (seeded)

Semua user dibuat via bootstrap, `isActive: true`.

| Email | Password | Role |
|---|---|---|
| admin@example.com | Admin123! | Super Admin |
| editor@example.com | Editor123! | Editor |
| author1@example.com | Author123! | Author |
| author2@example.com | Author123! | Author |

## 4. Roles & RBAC

3 role admin (default Strapi CE) di-provision + permission di-set via kode di `src/bootstrap.ts`. Ini kunci buat test permission di Selenium.

| Role | Content CRUD | Publish | Manage users | Media |
|---|---|---|---|---|
| **Super Admin** | Semua | Ya | Ya | Full |
| **Editor** | Full CRUD Article/Category/Page (termasuk konten user lain) | Ya (Article + Page) | Tidak | Full (read, configure-view, create/update/download/copy-link) |
| **Author** | Own-content-only Article & Page via kondisi `admin::is-creator` | **Tidak** | Tidak | Upload + own-only |

Detail permission Author:
- Article & Page: `create/read/update/delete` tapi **dibatasi kondisi `is-creator`** (cuma konten yang dia buat sendiri). Tidak ada action `publish`.
- Category: **read-only** (dibutuhkan supaya bisa pilih category di editor Article).
- Media: bisa `read` + `assets.create` (upload) + `download` + `copy-link`; `assets.update` dibatasi `is-creator`. Tidak bisa edit/hapus media milik orang lain.

## 5. Content model

Semua schema JSON ada di `src/api/<name>/content-types/<name>/schema.json`.

**Article** (`api::article.article`, collectionType, `draftAndPublish: true`)
- `title` — string, required, unique, minLength 5
- `slug` — uid (targetField: title)
- `body` — blocks
- `excerpt` — text, maxLength 300
- `category` — relation manyToOne → `api::category.category` (inversedBy `articles`)
- `coverImage` — media single, allowedTypes `images`
- `author` — relation oneToOne → `admin::user`

**Category** (`api::category.category`, collectionType, `draftAndPublish: false`)
- `name` — string, required, unique
- `slug` — uid (targetField: name)
- `description` — text
- `articles` — relation oneToMany → `api::article.article` (mappedBy `category`)

**Page** (`api::page.page`, collectionType, `draftAndPublish: true`)
- `title` — string, required
- `slug` — uid (targetField: title)
- `content` — blocks

## 6. Seed data

Dibuat oleh `src/bootstrap.ts`, semua step cek existing dulu (**idempotent**, aman re-run tanpa duplikat).

- **5 categories** — Technology, Design, Business, Science, Lifestyle
- **12 articles** — **9 published + 3 draft**, tersebar antar author/category:
  - author1 (Alice): 2 published + 1 draft
  - author2 (Bob): 2 published + 1 draft
  - editor (Erin): 2 published + 1 draft
  - admin (Site Admin): 3 published
  - 3 draft = "Draft Notes on Component Libraries", "Unfinished Thoughts on Remote Work", "Draft Review of Testing Frameworks"
- **3 pages** — About, Contact, Privacy Policy (semua published, milik admin)
- **5 media** — `seed-image-1`..`seed-image-5`, di-fetch dari **Lorem Picsum** (`picsum.photos`); kalau offline/timeout jatuh ke **fallback PNG 1x1** yang di-embed. `createdBy`/`updatedBy` article & page di-set langsung ke owner (kena row draft + published).

## 7. Automation gotchas (Selenium)

- **React SPA** — admin UI async; butuh explicit wait (element-visible / clickable), bukan asumsi page langsung ready.
- **URL content editor dinamis** — memuat content-type UID (`api::article.article`) + `documentId`/id numerik. **Jangan** locate lewat URL; pakai locator stabil: teks, `aria-*`, atau `data-*` attribute.
- **Admin UI tidak boleh dikustomisasi** (aturan repo) supaya locator tetap stabil lintas run.
- **Login flow**: `/admin/auth/login` (form email + password) → redirect ke dashboard.
- **Navigasi**: Content Manager → collection type → entry; publish/unpublish adalah workflow tombol terpisah dari save.
- **RBAC Author**: sebagian action UI disembunyikan atau kena **403** (mis. publish, edit konten milik orang lain). Test **dua-duanya** — jalur allowed dan jalur forbidden.
- **API alternatif** di `/api` (REST) bisa dipakai untuk setup/teardown data dengan **API token** — lebih cepat & stabil daripada lewat UI.

## 8. Reset / reseed

- Bootstrap **idempotent**: setiap re-run cek existing sebelum create, jadi menjalankan ulang `develop`/`start` tidak menggandakan data.
- **Full reset**: hapus volume Postgres lalu re-seed:
  ```bash
  docker compose down -v      # drop volume cms_strapi_pgdata
  docker compose up -d --wait
  npm run develop             # seed jalan ulang dari nol
  ```

## 9. Batasan

- **Lokal only** — tidak ada deploy ke cloud.
- **Tidak ada** custom plugin/controller/middleware.
- Hanya **3 content type**: Article, Category, Page.
- **Strapi version di-pin** (5.50.0) — jangan upgrade tanpa diminta (breaking change bisa merusak locator Selenium).
- Postgres pakai **host port 5433 → 5432** (port 5432 dipakai container lain, `course-platform-db`).
- Tidak ada script lint/type-check — gate satu-satunya `strapi build`.

> Detail lengkap SUT: lihat `docs/CMS_PROJECT_PLAN.md` (section 3 — SUT setup).

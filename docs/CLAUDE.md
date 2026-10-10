# CLAUDE.md — cms-strapi (SUT)

Repo ini adalah **System Under Test** untuk portfolio QA. Strapi CMS yang dikonfigurasi via code,
bukan produk yang didevelop. Jangan over-engineer — cukup stabil untuk di-test.

## Stack

Strapi 5 · Node.js 20+ · PostgreSQL (via Docker Compose) · TypeScript config

## Apa isi repo ini

- Content type schemas: Article, Category, Page (JSON di `src/api/`)
- Bootstrap script (`src/bootstrap.ts`): seed users (4), roles + permissions, content data
- Docker Compose: Strapi + PostgreSQL
- Tidak ada custom plugin/controller/middleware kecuali diminta

## Cara jalankan

```bash
docker compose up -d --wait    # Postgres
npm install
npm run develop                # http://localhost:1337/admin
```

Atau full Docker:
```bash
docker compose --profile full up -d    # (kalau disetup)
```

## Credentials seed

| Email | Password | Role |
|---|---|---|
| admin@example.com | Admin123! | Super Admin |
| editor@example.com | Editor123! | Editor |
| author1@example.com | Author123! | Author |
| author2@example.com | Author123! | Author |

## Rules

- ❌ JANGAN kustomisasi Strapi admin UI (locator harus stabil buat Selenium)
- ❌ JANGAN tambah content type di luar Article, Category, Page kecuali diminta
- ❌ JANGAN deploy ke cloud — lokal only
- ❌ JANGAN upgrade Strapi version tanpa diminta (breaking change locator)
- ✅ Seed HARUS idempotent (bisa re-run tanpa duplikat)
- ✅ Semua config via code, bukan UI manual
- ✅ Pin Strapi version di package.json

## Detail lengkap

Lihat `CMS_PROJECT_PLAN.md` section 3 (SUT setup).

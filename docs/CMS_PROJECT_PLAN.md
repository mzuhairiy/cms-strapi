# CMS Testing Project — Plan

> **Dua repo:** `cms-strapi` (SUT — app yang di-test) dan `cms-automation` (Selenium Java + Allure).
> Fokus portfolio: Selenium WebDriver, Page Object Model, TestNG data-driven, RBAC validation,
> multi-author workflow, dan Allure Report dashboard.

---

## 1. Project Brief

### Konteks

Headless CMS (Strapi) yang di-deploy lokal sebagai **System Under Test**. App ini bukan showcase —
yang jadi showcase adalah **automation suite di repo terpisah**. Strapi dipilih karena admin panel-nya
cukup kompleks (CRUD, RBAC 3 role, workflow, media library) tanpa perlu build dari nol.

### Apa yang di-test

- CRUD operations (Article, Category, Page) — create, read, update, delete, search, filter
- RBAC validation — 3 role (Super Admin, Editor, Author) dengan permission berbeda
- Multi-author workflow — Draft → Published, siapa boleh publish, ownership
- Media library — upload, delete, attach ke content
- Allure Report — dashboard cantik dengan severity, epic/feature/story, screenshot on failure

### Showcase skills

- **Selenium WebDriver 4** (bukan Playwright — sengaja beda tool)
- **Page Object Model** yang proper (bukan spaghetti locator)
- **TestNG** (data provider, groups, parallel, suite XML)
- **Allure Report** (annotation, screenshot, step log)
- **Java + Maven** (build system, dependency management)
- **Cross-browser** (Chrome + Firefox minimal)

---

## 2. Tech Stack

### SUT (`cms-strapi`)

| Layer | Choice |
|---|---|
| CMS | Strapi 5 (latest) |
| Runtime | Node.js 20+ |
| Database | PostgreSQL (via Docker Compose) |
| Deploy | Lokal (Docker Compose: Strapi + Postgres) |

### Automation (`cms-automation`)

| Layer | Choice |
|---|---|
| Language | Java 17 |
| Browser automation | Selenium WebDriver 4 |
| Test runner | TestNG |
| Build | Maven |
| Reporting | Allure Report |
| Driver management | WebDriverManager (auto-detect + download) |
| Test data | JavaFaker |
| Assertions | AssertJ (fluent assertions) |
| Logging | SLF4J + Logback |

---

## 3. SUT: Strapi Setup

### Content Types (3 tipe)

**Article** (collection type):
- `title` — string, required, unique, min 5
- `slug` — UID (auto dari title)
- `body` — rich text (blocks)
- `excerpt` — text, max 300 char
- `category` — relation (many-to-one ke Category)
- `coverImage` — media (single image)
- `author` — relation (many-to-one ke admin user)
- `status` — enumeration: draft / published (Strapi draft/publish system)

**Category** (collection type):
- `name` — string, required, unique
- `slug` — UID
- `description` — text

**Page** (collection type):
- `title` — string, required
- `slug` — UID
- `content` — rich text (blocks)
- `status` — draft / published

### Roles & Permissions (3 role)

| Role | Content CRUD | Publish | Manage users | Media library |
|---|---|---|---|---|
| Super Admin | All | ✅ | ✅ | Full |
| Editor | All (semua content) | ✅ | ❌ | Full |
| Author | Own content only | ❌ (cuma draft) | ❌ | Upload only |

Detail permission:
- **Author** bisa create article (otomatis jadi draft, miliknya). Bisa edit/delete article miliknya.
  TIDAK bisa publish. TIDAK bisa edit/delete article orang lain. TIDAK bisa manage users.
- **Editor** bisa CRUD semua article (milik siapapun). Bisa publish/unpublish. TIDAK bisa manage users.
- **Super Admin** bisa semua — termasuk manage users, roles, settings.

### Seed Data

| Data | Jumlah | Detail |
|---|---|---|
| Users | 4 | 1 Super Admin, 1 Editor, 2 Author |
| Categories | 5 | Technology, Design, Business, Science, Lifestyle |
| Articles | 12 | Mix: 8 published, 3 draft, 1 per Author. Tersebar di categories. |
| Pages | 3 | About, Contact, Privacy Policy (semua published) |
| Media | 5+ | Placeholder images (Lorem Picsum), attached ke beberapa articles |

### Credentials

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `Admin123!` | Super Admin |
| `editor@example.com` | `Editor123!` | Editor |
| `author1@example.com` | `Author123!` | Author |
| `author2@example.com` | `Author123!` | Author |

### Struktur Folder SUT

```
cms-strapi/
├── config/
│   ├── database.ts           # PostgreSQL config
│   ├── admin.ts
│   └── plugins.ts
├── src/
│   ├── api/
│   │   ├── article/
│   │   │   ├── content-types/article/schema.json
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── category/
│   │   │   └── content-types/category/schema.json
│   │   └── page/
│   │       └── content-types/page/schema.json
│   └── bootstrap.ts          # Seed: users, roles, permissions, content data
├── docker-compose.yml        # Strapi + PostgreSQL
├── .env.example
├── CLAUDE.md                 # Rules untuk agent
├── QA-HANDOFF.md             # Handoff doc (nanti)
└── README.md
```

---

## 4. Automation: Selenium Java + Allure

### Struktur Folder Automation

```
cms-automation/
├── src/
│   ├── main/java/com/qa/cms/
│   │   ├── config/
│   │   │   ├── ConfigReader.java       # Properties reader (base URL, credentials, browser)
│   │   │   └── DriverFactory.java      # WebDriver lifecycle (setup/teardown, browser choice)
│   │   ├── pages/
│   │   │   ├── BasePage.java           # Common waits, clicks, helpers
│   │   │   ├── LoginPage.java
│   │   │   ├── DashboardPage.java
│   │   │   ├── ArticleListPage.java
│   │   │   ├── ArticleEditorPage.java
│   │   │   ├── CategoryListPage.java
│   │   │   ├── CategoryEditorPage.java
│   │   │   ├── MediaLibraryPage.java
│   │   │   └── UserManagementPage.java
│   │   └── utils/
│   │       ├── WaitHelper.java         # Explicit waits wrapper
│   │       ├── ScreenshotHelper.java   # Screenshot on failure (Allure attach)
│   │       └── TestDataGenerator.java  # Faker-based data generation
│   └── test/java/com/qa/cms/
│       ├── base/
│       │   └── BaseTest.java           # @BeforeMethod/@AfterMethod — driver + Allure listener
│       ├── crud/
│       │   ├── ArticleCrudTest.java    # Create, Read, Update, Delete article
│       │   ├── CategoryCrudTest.java
│       │   └── PageCrudTest.java
│       ├── rbac/
│       │   ├── AuthorPermissionTest.java   # Author batas-batas akses
│       │   ├── EditorPermissionTest.java
│       │   └── SuperAdminPermissionTest.java
│       ├── workflow/
│       │   ├── PublishWorkflowTest.java    # Draft → Published, siapa boleh
│       │   └── MultiAuthorTest.java        # 2 author, ownership, conflict
│       ├── media/
│       │   └── MediaLibraryTest.java
│       └── smoke/
│           └── SmokeTest.java              # Login tiap role + verify dashboard
│   └── resources/
│       ├── config.properties               # base.url, browser, timeout, credentials
│       ├── testng-smoke.xml                # Smoke suite
│       ├── testng-crud.xml                 # CRUD regression suite
│       ├── testng-rbac.xml                 # RBAC suite
│       ├── testng-full.xml                 # Everything
│       └── testdata/
│           └── sample-image.jpg            # Untuk media upload test
├── allure-results/                         # Generated by Allure
├── pom.xml
├── CLAUDE.md
├── QA-HANDOFF.md
└── README.md
```

### pom.xml Dependencies

```xml
<!-- Core -->
selenium-java 4.x
testng 7.x
webdrivermanager 5.x

<!-- Assertions -->
assertj-core 3.x

<!-- Reporting -->
allure-testng 2.x

<!-- Data -->
javafaker 1.x

<!-- Logging -->
slf4j-api + logback-classic

<!-- Utility -->
lombok (opsional, reduce boilerplate)
```

### Page Object Model Convention

```java
// Setiap page class:
// - Extend BasePage
// - Locators sebagai private final By (BUKAN String)
// - Method nama = aksi user ("createArticle", "filterByCategory")
// - Return type = next page (untuk chaining)
// - JANGAN expose locator ke test — test cuma panggil method

public class ArticleListPage extends BasePage {
    private final By createButton = By.cssSelector("[data-testid='create-entry']"); // contoh
    private final By searchInput = By.cssSelector("input[name='search']");

    public ArticleEditorPage clickCreate() {
        click(createButton);
        return new ArticleEditorPage(driver);
    }

    public ArticleListPage searchArticle(String keyword) {
        type(searchInput, keyword);
        waitForListUpdate();
        return this;
    }
}
```

### Allure Annotations (convention)

```java
@Epic("Content Management")
@Feature("Article CRUD")
@Story("Create Article")
@Severity(SeverityLevel.CRITICAL)
@Description("Verify Super Admin can create article with all fields")
@Test
public void testCreateArticleAllFields() {
    // @Step annotations di page methods buat granular step reporting
}
```

Setiap test wajib punya: `@Epic`, `@Feature`, `@Severity`. `@Story` dan `@Description` recommended.
Screenshot otomatis di-attach ke Allure saat test gagal (via TestNG listener di BaseTest).

---

## 5. Test Suites Detail

### Suite 1: Smoke (`testng-smoke.xml`)

Jalanin pertama. Kalau ini gagal, jangan lanjut.

| Test | Deskripsi |
|---|---|
| Login Super Admin | Login → verify dashboard load |
| Login Editor | Login → verify dashboard load |
| Login Author | Login → verify dashboard load |
| Invalid login | Wrong password → error message |
| Article list accessible | Navigate → list tampil |
| Category list accessible | Navigate → list tampil |

### Suite 2: CRUD Regression (`testng-crud.xml`)

| Test | Deskripsi | Data-driven? |
|---|---|---|
| Create article (semua field) | Isi title, body, category, image, save draft | ❌ |
| Create article (minimal field) | Cuma required fields | ❌ |
| Create article (invalid — title kosong) | Submit tanpa title → validation error | ❌ |
| Read article (search by title) | Cari di list → ketemu | ❌ |
| Read article (filter by category) | Filter dropdown → list ter-filter | ❌ |
| Update article | Edit title + body → save → verify persisted | ❌ |
| Delete article | Delete → confirm → gone from list | ❌ |
| Create category | Nama + slug | ❌ |
| Duplicate category (unique) | Sama nama → error | ❌ |
| Create article — multi data | DataProvider: 3 set data berbeda | ✅ TestNG DataProvider |

### Suite 3: RBAC (`testng-rbac.xml`)

Ini yang paling kaya — permission matrix 3 role × N action.

| Test | Role | Expected |
|---|---|---|
| Author create article | Author | ✅ Created, status draft, owned by author |
| Author publish own article | Author | ❌ Blocked (gak ada tombol publish / action ditolak) |
| Author edit own article | Author | ✅ |
| Author edit other's article | Author | ❌ Blocked (gak visible / access denied) |
| Author delete other's article | Author | ❌ Blocked |
| Author access user management | Author | ❌ Menu gak ada / redirect |
| Editor edit anyone's article | Editor | ✅ |
| Editor publish article | Editor | ✅ |
| Editor access user management | Editor | ❌ |
| Super Admin manage users | Super Admin | ✅ |
| Super Admin change role | Super Admin | ✅ |
| Super Admin delete user | Super Admin | ✅ |

### Suite 4: Workflow (`testng-workflow.xml`)

| Test | Deskripsi |
|---|---|
| Author draft → Editor publish | Author bikin draft → login Editor → find article → publish → verify published |
| Author gak bisa publish sendiri | Author bikin draft → coba publish → blocked |
| Editor unpublish article | Published → unpublish → verify draft |
| Multi-author ownership | Author1 bikin article → login Author2 → verify gak bisa edit |

### Suite 5: Media (`testng-media.xml`)

| Test | Deskripsi |
|---|---|
| Upload image | Upload sample-image.jpg → verify muncul di library |
| Attach image to article | Buat article → attach image dari library → save → verify |
| Delete media | Delete image → gone from library |

---

## 6. Phase Roadmap

### Fase 1 — SUT Setup (agent gas, minim HITL)

| Step | Prompt |
|---|---|
| P1 | Scaffold Strapi + Docker Compose + PostgreSQL config |
| P2 | Content type schemas (Article, Category, Page) via code |
| P3 | Bootstrap script: roles, permissions, users, seed data |
| P4 | Verify: `docker compose up` → Strapi running → login semua role → data ada |

**DoD Fase 1:** Strapi jalan di lokal, 4 user bisa login, 3 content types ada, 12 articles + 5 categories + 3 pages terisi, RBAC enforced.

### Fase 2 — Automation Foundation (lo terjun, agent assist)

| Step | Prompt |
|---|---|
| P5 | Maven project scaffold + pom.xml + folder structure |
| P6 | DriverFactory + ConfigReader + BaseTest + Allure listener |
| P7 | BasePage + LoginPage + DashboardPage (fondasi POM) |
| P8 | Smoke suite — login tiap role, invalid login, verify dashboard |

**DoD Fase 2:** `mvn test -DsuiteXmlFile=testng-smoke.xml` hijau, Allure report generate, screenshot on failure jalan.

### Fase 3 — CRUD + RBAC (core showcase)

| Step | Prompt |
|---|---|
| P9 | ArticleListPage + ArticleEditorPage + CRUD tests |
| P10 | CategoryListPage + CategoryEditorPage + CRUD tests |
| P11 | RBAC tests — Author permission matrix |
| P12 | RBAC tests — Editor + Super Admin permission matrix |

**DoD Fase 3:** CRUD + RBAC suites hijau, Allure report nunjukin test matrix yang kaya.

### Fase 4 — Workflow + Media + Polish

| Step | Prompt |
|---|---|
| P13 | Workflow tests (draft → publish, multi-author ownership) |
| P14 | MediaLibraryPage + media tests |
| P15 | Polish: TestNG DataProvider buat data-driven CRUD, cross-browser (Firefox), README, QA-HANDOFF.md |

**DoD Fase 4:** Full suite hijau di Chrome + Firefox, Allure dashboard cantik, README + QA-HANDOFF.md lengkap.

---

## 7. Anti-Pattern Checklist

### SUT (Strapi)
- ❌ Jangan kustomisasi Strapi lebih dari yang dibutuhin (ini SUT, bukan produk)
- ❌ Jangan deploy ke cloud — lokal cukup
- ❌ Jangan ubah admin panel UI (supaya test locator stabil antar versi Strapi)

### Automation
- ❌ JANGAN expose locator ke test class — locator cuma di page object
- ❌ JANGAN `Thread.sleep()` — pakai explicit wait (WebDriverWait + ExpectedConditions)
- ❌ JANGAN hardcode URL/credentials di test — pakai config.properties
- ❌ JANGAN bikin test yang depend ke test lain (tiap test harus independen, bisa jalan sendiri)
- ❌ JANGAN skip Allure annotations (@Epic/@Feature/@Severity minimal)
- ❌ JANGAN catch exception diam-diam — biarkan gagal dengan stack trace yang jelas
- ❌ JANGAN bikin page object method yang return void kalau bisa return next page (chaining)
- ❌ JANGAN pakai Absolute XPath — pakai relative XPath, CSS selector, atau data attribute

### Convention
- ✅ Test method name: `testXxx` (TestNG convention)
- ✅ Page method name: kata kerja (`clickCreate`, `searchArticle`, `verifyTitle`)
- ✅ Satu test = satu assertion concern (boleh multiple assert kalau satu flow, tapi jelas)
- ✅ Screenshot on failure otomatis via listener — jangan manual
- ✅ Clean up test data di @AfterMethod kalau test bikin data baru

---

## 8. Cara Pakai (Claude Code)

### SUT repo (`cms-strapi`)
1. Taruh `CLAUDE.md` di root
2. Prompt per step (P1–P4)
3. Verify: `docker compose up` → buka `http://localhost:1337/admin` → login semua role

### Automation repo (`cms-automation`)
1. Taruh `CLAUDE.md` di root
2. Pastikan SUT jalan (`docker compose up` di cms-strapi)
3. Prompt per step (P5–P15)
4. Verify per step: `mvn test -DsuiteXmlFile=testng-xxx.xml` → hijau
5. Allure report: `mvn allure:serve` → browser buka dashboard

### Catatan penting
- **SUT harus jalan sebelum run automation** — Selenium butuh browser yang buka Strapi admin
- **Strapi admin panel locator bisa berubah antar versi** — pin Strapi version di package.json
- **Fase 2+ (automation) = lo terjun deep** — agent assist tapi lo yang drive, sesuai rencana lo

---

## 9. Hubungan ke Portfolio QA

| Proyek | Automation tool | Hook type |
|---|---|---|
| Petpals (E-commerce) | Playwright | `data-testid` |
| CoursePlatform | Playwright BDD | `data-testid` |
| **CMS (ini)** | **Selenium Java** | **CSS selector + XPath** (SUT bukan milik lo, gak bisa inject testid) |
| Admin Dashboard | Katalon Studio | TBD |
| Mobile E-Commerce | Appium | `resource-id` / `content-desc` |
| Finance App | Maestro | `testID` (RN prop) |

**Yang membedakan proyek ini:** lo gak build SUT-nya, dan gak bisa inject `data-testid`. Ini lebih realistis — di dunia nyata QA sering test app yang bukan mereka develop, dengan locator apa adanya. Itu skill yang beda dari Petpals/CoursePlatform.

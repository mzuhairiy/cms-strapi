import type { Core } from '@strapi/strapi';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Seed idempotent untuk SUT QA portfolio:
 * - 3 admin roles (Super Admin / Editor / Author — default Strapi CE)
 * - Permissions: Editor = full content + publish; Author = own content only, no publish
 * - 4 admin users
 * - 5 categories, 12 articles (9 published / 3 draft), 3 pages (published)
 * - 5 placeholder images (Lorem Picsum, fallback ke embedded PNG kalau offline)
 *
 * Semua step cek existing dulu — aman di-re-run tanpa duplikat.
 */

const log = (msg: string) => strapi.log.info(`[seed] ${msg}`);

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const blocks = (...paragraphs: string[]) =>
  paragraphs.map((text) => ({
    type: 'paragraph' as const,
    children: [{ type: 'text' as const, text }],
  }));

// ---------------------------------------------------------------------------
// Roles & users
// ---------------------------------------------------------------------------

const ROLES = [
  { name: 'Super Admin', code: 'strapi-super-admin', description: 'Super Admins can access and manage all features and settings.' },
  { name: 'Editor', code: 'strapi-editor', description: 'Editors can manage and publish contents including those of other users.' },
  { name: 'Author', code: 'strapi-author', description: 'Authors can manage the content they created.' },
];

const USERS = [
  { email: 'admin@example.com', password: 'Admin123!', firstname: 'Site', lastname: 'Admin', roleCode: 'strapi-super-admin' },
  { email: 'editor@example.com', password: 'Editor123!', firstname: 'Erin', lastname: 'Editor', roleCode: 'strapi-editor' },
  { email: 'author1@example.com', password: 'Author123!', firstname: 'Alice', lastname: 'Author', roleCode: 'strapi-author' },
  { email: 'author2@example.com', password: 'Author123!', firstname: 'Bob', lastname: 'Author', roleCode: 'strapi-author' },
];

async function ensureRoles(): Promise<Record<string, any>> {
  const roles: Record<string, any> = {};
  for (const def of ROLES) {
    let role = await strapi.db.query('admin::role').findOne({ where: { code: def.code } });
    if (!role) {
      role = await strapi.db.query('admin::role').create({ data: def });
      log(`role created: ${def.name}`);
    }
    roles[def.code] = role;
  }
  return roles;
}

async function ensureUsers(roles: Record<string, any>): Promise<Record<string, any>> {
  const users: Record<string, any> = {};
  for (const def of USERS) {
    let user = await strapi.db.query('admin::user').findOne({ where: { email: def.email } });
    if (!user) {
      user = await strapi.service('admin::user').create({
        email: def.email,
        firstname: def.firstname,
        lastname: def.lastname,
        password: def.password,
        isActive: true,
        registrationToken: null,
        roles: [roles[def.roleCode].id],
      });
      log(`user created: ${def.email} (${def.roleCode})`);
    }
    users[def.email] = user;
  }
  return users;
}

// ---------------------------------------------------------------------------
// Permissions (RBAC)
// ---------------------------------------------------------------------------

const CM = 'plugin::content-manager.explorer';
const IS_CREATOR = 'admin::is-creator';

const CT_FIELDS: Record<string, string[]> = {
  'api::article.article': ['title', 'slug', 'body', 'excerpt', 'category', 'coverImage', 'author'],
  'api::category.category': ['name', 'slug', 'description', 'articles'],
  'api::page.page': ['title', 'slug', 'content'],
};

type PermDef = { action: string; subject?: string | null; fields?: string[] | null; conditions?: string[] };

function contentPerms(subject: string, actions: string[], conditions: string[] = []): PermDef[] {
  return actions.map((a) => ({
    action: `${CM}.${a}`,
    subject,
    fields: ['create', 'read', 'update'].includes(a) ? CT_FIELDS[subject] : null,
    conditions,
  }));
}

const EDITOR_PERMS: PermDef[] = [
  ...contentPerms('api::article.article', ['create', 'read', 'update', 'delete', 'publish']),
  ...contentPerms('api::category.category', ['create', 'read', 'update', 'delete']),
  ...contentPerms('api::page.page', ['create', 'read', 'update', 'delete', 'publish']),
  // Media library: full
  { action: 'plugin::upload.read' },
  { action: 'plugin::upload.configure-view' },
  { action: 'plugin::upload.assets.create' },
  { action: 'plugin::upload.assets.update' },
  { action: 'plugin::upload.assets.download' },
  { action: 'plugin::upload.assets.copy-link' },
];

const AUTHOR_PERMS: PermDef[] = [
  // Own content only — no publish
  ...contentPerms('api::article.article', ['create', 'read', 'update', 'delete'], [IS_CREATOR]),
  ...contentPerms('api::page.page', ['create', 'read', 'update', 'delete'], [IS_CREATOR]),
  // Categories: read-only (perlu buat milih category di article editor)
  ...contentPerms('api::category.category', ['read']),
  // Media library: upload + pakai, gak bisa edit/delete punya orang
  { action: 'plugin::upload.read' },
  { action: 'plugin::upload.assets.create' },
  { action: 'plugin::upload.assets.update', conditions: [IS_CREATOR] },
  { action: 'plugin::upload.assets.download' },
  { action: 'plugin::upload.assets.copy-link' },
];

async function ensurePermissions(role: any, perms: PermDef[]) {
  let created = 0;
  for (const p of perms) {
    const existing = await strapi.db.query('admin::permission').findOne({
      where: { action: p.action, subject: p.subject ?? null, role: { id: role.id } },
    });
    if (existing) continue;
    await strapi.db.query('admin::permission').create({
      data: {
        action: p.action,
        actionParameters: {},
        subject: p.subject ?? null,
        properties: p.fields ? { fields: p.fields } : {},
        conditions: p.conditions ?? [],
        role: role.id,
      },
    });
    created++;
  }
  if (created > 0) log(`permissions created for ${role.name}: ${created}`);
}

// ---------------------------------------------------------------------------
// Media (placeholder images)
// ---------------------------------------------------------------------------

// 1x1 abu-abu — fallback kalau Lorem Picsum gak kejangkau saat seed
const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNsaGj4DwAFhAJ/1Y1QwQAAAABJRU5ErkJggg==',
  'base64'
);

async function ensureMedia(): Promise<any[]> {
  const uploadService = strapi.plugin('upload').service('upload');
  const files: any[] = [];

  for (let i = 1; i <= 5; i++) {
    const name = `seed-image-${i}`;
    const existing = await strapi.db.query('plugin::upload.file').findOne({ where: { name } });
    if (existing) {
      files.push(existing);
      continue;
    }

    let buffer: Buffer;
    let ext = 'jpg';
    let mime = 'image/jpeg';
    try {
      const res = await fetch(`https://picsum.photos/seed/cms-${i}/800/450`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      strapi.log.warn(`[seed] picsum fetch failed for ${name} (${err}), pakai fallback PNG`);
      buffer = FALLBACK_PNG;
      ext = 'png';
      mime = 'image/png';
    }

    const tmpPath = path.join(os.tmpdir(), `${name}.${ext}`);
    fs.writeFileSync(tmpPath, buffer);
    try {
      const uploaded = await uploadService.upload({
        data: { fileInfo: { name, alternativeText: name, caption: name } },
        files: {
          filepath: tmpPath,
          originalFilename: `${name}.${ext}`,
          mimetype: mime,
          size: buffer.length,
        },
      });
      const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      files.push(file);
      log(`media uploaded: ${name}.${ext}`);
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Content: categories, articles, pages
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: 'Technology', description: 'Software, hardware, and everything in between.' },
  { name: 'Design', description: 'UI, UX, and visual design topics.' },
  { name: 'Business', description: 'Strategy, startups, and market insights.' },
  { name: 'Science', description: 'Research, discoveries, and explainers.' },
  { name: 'Lifestyle', description: 'Health, habits, and everyday living.' },
];

async function ensureCategories(): Promise<Record<string, any>> {
  const cats: Record<string, any> = {};
  for (const def of CATEGORIES) {
    let cat = await strapi.db.query('api::category.category').findOne({ where: { name: def.name } });
    if (!cat) {
      cat = await strapi.documents('api::category.category').create({
        data: { name: def.name, slug: slugify(def.name), description: def.description },
      });
      log(`category created: ${def.name}`);
    }
    cats[def.name] = cat;
  }
  return cats;
}

// 12 articles: 9 published + 3 draft. Tiap author punya konten sendiri (buat test ownership).
const ARTICLES = [
  { title: 'Getting Started with Headless CMS', category: 'Technology', author: 'author1@example.com', published: true, image: 0 },
  { title: 'Ten Design Principles That Never Age', category: 'Design', author: 'author1@example.com', published: true, image: 1 },
  { title: 'Draft Notes on Component Libraries', category: 'Design', author: 'author1@example.com', published: false, image: null },
  { title: 'Why Small Teams Ship Faster', category: 'Business', author: 'author2@example.com', published: true, image: 2 },
  { title: 'The Science of Habit Formation', category: 'Science', author: 'author2@example.com', published: true, image: 3 },
  { title: 'Unfinished Thoughts on Remote Work', category: 'Lifestyle', author: 'author2@example.com', published: false, image: null },
  { title: 'PostgreSQL Performance Tuning Basics', category: 'Technology', author: 'editor@example.com', published: true, image: 4 },
  { title: 'A Field Guide to Brainstorming', category: 'Business', author: 'editor@example.com', published: true, image: 0 },
  { title: 'Draft Review of Testing Frameworks', category: 'Technology', author: 'editor@example.com', published: false, image: null },
  { title: 'Morning Routines of Productive People', category: 'Lifestyle', author: 'admin@example.com', published: true, image: 1 },
  { title: 'Quantum Computing for the Curious', category: 'Science', author: 'admin@example.com', published: true, image: 2 },
  { title: 'Announcing Our New Editorial Guidelines', category: 'Business', author: 'admin@example.com', published: true, image: 3 },
];

// Set createdBy/updatedBy langsung di kolom join (entity manager gak nerima
// creator fields via updateMany) — kena draft + published row sekaligus.
async function setOwnership(tableName: string, documentId: string, userId: number) {
  await strapi.db
    .connection(tableName)
    .where({ document_id: documentId })
    .update({ created_by_id: userId, updated_by_id: userId });
}

async function ensureArticles(
  cats: Record<string, any>,
  users: Record<string, any>,
  media: any[]
) {
  for (const def of ARTICLES) {
    const owner = users[def.author];
    const existing = await strapi.db.query('api::article.article').findOne({ where: { title: def.title } });
    if (existing) {
      await setOwnership('articles', existing.documentId, owner.id);
      continue;
    }

    const doc = await strapi.documents('api::article.article').create({
      data: {
        title: def.title,
        slug: slugify(def.title),
        excerpt: `${def.title} — a seeded article for QA automation testing.`,
        body: blocks(
          `${def.title}. This article is seed data for the QA portfolio project.`,
          'It exists so Selenium tests have stable, predictable content to assert against.',
          'Do not edit manually; re-running the seed will not duplicate it.'
        ),
        category: cats[def.category].id,
        author: owner.id,
        coverImage: def.image !== null && media[def.image] ? media[def.image].id : null,
      },
    });

    if (def.published) {
      await strapi.documents('api::article.article').publish({ documentId: doc.documentId });
    }

    await setOwnership('articles', doc.documentId, owner.id);

    log(`article created: "${def.title}" (${def.published ? 'published' : 'draft'}, ${def.author})`);
  }
}

const PAGES = [
  { title: 'About', content: ['We are a demo publication used as a System Under Test for QA automation.'] },
  { title: 'Contact', content: ['Reach the editorial team at hello@example.com.', 'Office hours: Monday to Friday, 9am-5pm.'] },
  { title: 'Privacy Policy', content: ['This demo site stores no real user data.', 'All content is seeded for testing purposes only.'] },
];

async function ensurePages(users: Record<string, any>) {
  const admin = users['admin@example.com'];
  for (const def of PAGES) {
    const existing = await strapi.db.query('api::page.page').findOne({ where: { title: def.title } });
    if (existing) {
      await setOwnership('pages', existing.documentId, admin.id);
      continue;
    }

    const doc = await strapi.documents('api::page.page').create({
      data: { title: def.title, slug: slugify(def.title), content: blocks(...def.content) },
    });
    await strapi.documents('api::page.page').publish({ documentId: doc.documentId });
    await setOwnership('pages', doc.documentId, admin.id);
    log(`page created: "${def.title}" (published)`);
  }
}

// ---------------------------------------------------------------------------

export default async function bootstrap({ strapi: _strapi }: { strapi: Core.Strapi }) {
  log('seeding start');

  const roles = await ensureRoles();
  const users = await ensureUsers(roles);
  await ensurePermissions(roles['strapi-editor'], EDITOR_PERMS);
  await ensurePermissions(roles['strapi-author'], AUTHOR_PERMS);

  const cats = await ensureCategories();
  const media = await ensureMedia();
  await ensureArticles(cats, users, media);
  await ensurePages(users);

  log('seeding done');
}

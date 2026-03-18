import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../database/connection';

const firstNames = [
  'Alice', 'Bob', 'Clara', 'David', 'Emma', 'Félix', 'Grace', 'Hugo',
  'Inès', 'Jules', 'Kévin', 'Laura', 'Marc', 'Nina', 'Oscar', 'Pauline',
  'Quentin', 'Rose', 'Samuel', 'Théa', 'Ugo', 'Victoire', 'William',
  'Xénia', 'Yann', 'Zoé', 'Adam', 'Béatrice', 'Cyril', 'Diane',
];

const lastNames = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit',
  'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel',
  'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel',
  'Girard', 'André', 'Lefèvre', 'Mercier', 'Dupont', 'Lambert', 'Bonnet',
  'François', 'Martinez',
];

const countries = [
  'France', 'Belgium', 'Switzerland', 'Canada', 'Morocco',
  'Tunisia', 'Algeria', 'Senegal', 'Luxembourg', 'Germany',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.');
}

async function seed() {
  const password      = await bcrypt.hash('password123', 12);
  const adminPassword = await bcrypt.hash('admin', 12);

  // ── Admin user ────────────────────────────────────────────────────────────
  console.log('🔐  Seeding admin user…');
  try {
    await pool.query(
      `INSERT INTO users (firstName, lastName, email, password, country, phone, role, blocked)
       VALUES (?, ?, ?, ?, ?, ?, 'admin', false)`,
      ['Admin', 'UCPE', 'admin@ucpe.fr', adminPassword, 'France', null]
    );
    console.log('  ✓  Admin <admin@ucpe.fr>');
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log('  –  skipped duplicate: admin@ucpe.fr');
    } else {
      throw err;
    }
  }

  // ── Regular users ─────────────────────────────────────────────────────────
  const users: {
    firstName: string;
    lastName: string;
    email: string;
    country: string;
    phone: string;
  }[] = [];

  while (users.length < 50) {
    const firstName = pick(firstNames);
    const lastName  = pick(lastNames);
    const n         = users.length + 1;
    const email     = `${slugify(firstName)}.${slugify(lastName)}${n}@example.com`;

    users.push({
      firstName,
      lastName,
      email,
      country: pick(countries),
      phone: `+33 6 ${String(Math.floor(Math.random() * 90000000) + 10000000).replace(/(\d{2})(?=\d)/g, '$1 ')}`,
    });
  }

  console.log('\n🌱  Seeding 50 users…');

  for (const u of users) {
    try {
      await pool.query(
        `INSERT INTO users (firstName, lastName, email, password, country, phone, role, blocked)
         VALUES (?, ?, ?, ?, ?, ?, 'client', false)`,
        [u.firstName, u.lastName, u.email, password, u.country, u.phone]
      );
      console.log(`  ✓  ${u.firstName} ${u.lastName} <${u.email}>`);
    } catch (err: any) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log(`  –  skipped duplicate: ${u.email}`);
      } else {
        throw err;
      }
    }
  }

  console.log('\n✅  Done.');
  console.log('   Admin   → admin@ucpe.fr   / admin');
  console.log('   Clients → *@example.com   / password123');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
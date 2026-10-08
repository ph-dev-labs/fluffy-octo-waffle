import { randomBytes, scrypt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { gallery, testimonials } from "../src/content/site";

const db = new PrismaClient();
const R2 = "https://pub-ab61e9141ab444a2a62d1178bcf81b10.r2.dev/containers";

const IMG = {
  hc40: [`${R2}/1790521534103/1790521535495-weot3eas.jpg`, `${R2}/1790521537719/1790521539737-rcdaiup0.jpg`, `${R2}/1790521541439/1790521542431-rs1gkat1.jpg`, `${R2}/1790521545132/1790521546183-tsxiarmg.jpg`],
  used20: [`${R2}/1/1790520921775-ndt81c3g.jpg`, `${R2}/1/1790520926467-zfcxv6xz.jpg`, `${R2}/1/1790520929427-k4kt3mj4.jpg`],
  big40: [`${R2}/7/1790521227127-22f0h193.jpg`, `${R2}/7/1790521233397-h6fqzfnf.jpg`, `${R2}/7/1790521318256-2psctiun.jpg`],
};

const naira = (n: number) => n * 100;

// TODO(client): replace with the live inventory (or build an admin to manage it).
const containers = [
  {
    slug: "brand-new-40ft-high-cube",
    title: "Brand New 40ft High Cube",
    summary: "One-trip 40HC, CSC plated, cargo-worthy.",
    description:
      "A one-trip 40ft High Cube container in excellent condition. Extra 1ft of height over a standard 40ft makes it ideal for bulky cargo, site offices and conversions. Corten steel body, marine-grade plywood floor, lockbox ready.",
    size: "40HC", type: "DRY", condition: "NEW", terminal: "Lagos — Apapa", priceKobo: naira(4_000_000), images: IMG.hc40, stock: 6, featured: true,
  },
  {
    slug: "used-20ft-standard",
    title: "Used 20ft Standard",
    summary: "Wind & watertight, clean interior, ready for storage.",
    description:
      "20DV used shipping container, clean, wind and watertight. Perfect for on-site storage, small shops and workshops. Inspected by our team before listing.",
    size: "20FT", type: "DRY", condition: "USED", terminal: "Lagos — Apapa", priceKobo: naira(2_450_000), images: IMG.used20, stock: 12, featured: true,
  },
  {
    slug: "used-40ft-high-cube",
    title: "Used 40ft High Cube",
    summary: "Cargo-worthy 40HC with solid doors and seals.",
    description:
      "Cargo-worthy 40ft High Cube with solid doors, intact gaskets and a sound floor. Great value for warehousing and export.",
    size: "40HC", type: "DRY", condition: "USED", terminal: "Lagos — Tin Can Island", priceKobo: naira(3_350_000), images: IMG.big40, stock: 4, featured: true,
  },
  {
    slug: "refurbished-20ft-site-office",
    title: "Refurbished 20ft Container",
    summary: "Repainted, new floor, ideal for conversion.",
    description: "Refurbished 20ft container: rust treated, fully repainted and fitted with a new floor. A great base for site offices, kiosks and pop-up shops.",
    size: "20FT", type: "DRY", condition: "REFURBISHED", terminal: "Port Harcourt — Onne", priceKobo: naira(2_900_000), images: [...IMG.used20].reverse(), stock: 3, featured: false,
  },
  {
    slug: "brand-new-20ft-standard",
    title: "Brand New 20ft Standard",
    summary: "One-trip 20DV with lockbox and forklift pockets.",
    description: "A one-trip 20ft dry van in near-new condition, complete with lockbox and forklift pockets. Corten steel, CSC plated.",
    size: "20FT", type: "DRY", condition: "NEW", terminal: "Lagos — Tin Can Island", priceKobo: naira(3_100_000), images: [IMG.used20[1], IMG.used20[0], IMG.used20[2]], stock: 5, featured: false,
  },
  {
    slug: "used-40ft-standard",
    title: "Used 40ft Standard",
    summary: "Budget-friendly 40DV, wind & watertight.",
    description: "Budget-friendly 40ft standard container, wind and watertight, with minor cosmetic dents. Inspected before sale.",
    size: "40FT", type: "DRY", condition: "USED", terminal: "Port Harcourt — Onne", priceKobo: naira(2_950_000), images: [IMG.big40[1], IMG.big40[0], IMG.big40[2]], stock: 0, featured: false,
  },
];

// Same format as src/lib/auth/password.ts (that file is server-only, so it isn't imported here).
function hashPassword(password: string): Promise<string> {
  const N = 2 ** 15, r = 8, p = 1;
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`),
    ),
  );
}

function generatePassword(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%^*-_";
  return Array.from(randomBytes(length), (b) => alphabet[b % alphabet.length]).join("");
}

async function seedAdmin() {
  const email = (process.env.ADMIN_SEED_EMAIL || "admin@c-zuchigrp.com").trim().toLowerCase();
  const name = process.env.ADMIN_SEED_NAME || "C-ZUCHI Admin";
  const existing = await db.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists — password left unchanged.`);
    return;
  }
  const provided = process.env.ADMIN_SEED_PASSWORD;
  if (provided && (provided.length < 12 || !/[A-Za-z]/.test(provided) || !/[0-9]/.test(provided))) {
    throw new Error("ADMIN_SEED_PASSWORD must be at least 12 characters and include a letter and a number.");
  }
  const password = provided || generatePassword();
  await db.adminUser.create({ data: { email, name, role: "OWNER", passwordHash: await hashPassword(password), mustChangePassword: true } });
  console.log("\n=== Owner admin created (must change password at first sign-in) ===");
  console.log(`  URL:      /admin/login`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${provided ? "(the ADMIN_SEED_PASSWORD you set)" : password}`);
  console.log("");
}

async function main() {
  // Create-only (update: {}): re-running the seed never overwrites admin edits.
  for (const c of containers) {
    const data = { ...c, images: JSON.stringify(c.images) };
    await db.container.upsert({ where: { slug: c.slug }, update: {}, create: data });
  }

  // Delivery states, Lagos areas and distance-pricing defaults are created by migration 0004.

  if ((await db.galleryItem.count()) === 0) {
    await db.galleryItem.createMany({ data: gallery.map((g, i) => ({ type: g.type, url: g.src, caption: g.caption, sortOrder: i })) });
  }

  // Only the CEO quote is real; placeholder testimonials are NOT seeded.
  if ((await db.testimonial.count()) === 0) {
    const real = testimonials.filter((t) => !t.quote.startsWith("Placeholder"));
    if (real.length) await db.testimonial.createMany({ data: real.map((t, i) => ({ ...t, sortOrder: i })) });
  }

  await seedAdmin();
  console.log(`Seed complete: ${containers.length} containers, gallery + testimonials.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

// Emergency reset for an admin's password, run from a trusted terminal:
//   npm run admin:reset -- admin@c-zuchigrp.com
// Prints a new one-time password (must be changed at next sign-in), unlocks
// the account and signs out all of its sessions.
import { randomBytes, scrypt } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function hashPassword(password: string): Promise<string> {
  const N = 2 ** 15, r = 8, p = 1;
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`),
    ),
  );
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run admin:reset -- <admin email>");
  const user = await db.adminUser.findUnique({ where: { email } });
  if (!user) throw new Error(`No admin with email ${email}`);

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%^*-_";
  const password = Array.from(randomBytes(20), (b) => alphabet[b % alphabet.length]).join("") + "7";

  await db.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null, active: true },
  });
  await db.adminSession.deleteMany({ where: { userId: user.id } });
  await db.auditLog.create({ data: { userId: null, action: "admin.reset_password_cli", target: email } });

  console.log(`\nTemporary password for ${email}:\n\n  ${password}\n\nSign in at /admin/login — you'll be asked to set a new password.\n`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

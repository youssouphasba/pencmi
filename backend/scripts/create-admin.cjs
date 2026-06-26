const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

function loadEnvFile() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();

const { PrismaClient, AccountStatus, UserRole } = require("@prisma/client");

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }

  return args;
}

function printUsage() {
  console.log([
    "Usage:",
    "npm run admin:create -- --email admin@example.com --password \"MotDePasseFort123!\"",
    "",
    "Options:",
    "--email       Email du compte admin",
    "--password    Mot de passe du compte admin",
    "--first-name  Prénom facultatif",
    "--last-name   Nom facultatif",
    "--phone       Téléphone facultatif",
    "--city        Ville facultative",
  ].join("\n"));
}

function isValidEmail(value) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(value || "").trim());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.email || "").trim().toLowerCase();
  const password = String(args.password || "");
  const firstName = String(args["first-name"] || "").trim() || null;
  const lastName = String(args["last-name"] || "").trim() || null;
  const phone = String(args.phone || "").trim() || null;
  const city = String(args.city || "").trim() || null;

  if (!email || !password) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!isValidEmail(email)) {
    throw new Error("L'email fourni est invalide.");
  }

  if (password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  let user;

  if (existingUser) {
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: UserRole.admin,
        status: AccountStatus.active,
        email,
        phone,
        firstName,
        lastName,
        city,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    console.log("Compte existant promu en admin.");
  } else {
    user = await prisma.user.create({
      data: {
        role: UserRole.admin,
        status: AccountStatus.active,
        email,
        phone,
        firstName,
        lastName,
        city,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    console.log("Compte admin créé.");
  }

  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

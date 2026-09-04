import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";
const EMAIL = "testauth@agora.local";
const PASSWORD = "SecurePass123!";

let cookieJar = {};

function readSetCookies(res) {
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const idx = pair.indexOf("=");
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value && value !== "deleted") cookieJar[name] = value;
    else delete cookieJar[name];
  }
}

function cookieHeader() {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function get(path) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: { cookie: cookieHeader() } });
  readSetCookies(res);
  return res;
}

async function postForm(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams(body),
  });
  readSetCookies(res);
  return res;
}

async function main() {
  // 1. Seed a user with a bcrypt password hash
  const pwHash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash: pwHash },
    create: { email: EMAIL, name: "Test Auth", role: "ENGINEER", passwordHash: pwHash },
  });
  console.log("1. Seeded user");

  // 2. Unauthenticated /incidents should be a 307 redirect to /login
  const unauth = await get("/incidents");
  const loc = unauth.headers.get("location") || "";
  console.log(`2. Unauthenticated /incidents -> status=${unauth.status}, location=${loc}`);
  const redirectedToLogin = unauth.status === 307 && loc.includes("/login");
  console.log(`   redirect to login: ${redirectedToLogin}`);

  // 3. Unauthenticated API should be 401
  const unauthApi = await get("/api/incidents/search");
  console.log(`3. Unauthenticated /api/incidents/search -> status=${unauthApi.status}`);

  // 4. Fetch CSRF token
  const csrfRes = await get("/api/auth/csrf");
  const csrf = (await csrfRes.json()).csrfToken;
  console.log(`4. CSRF token fetched: ${!!csrf}`);

  // 5. Perform credentials sign-in
  const signin = await postForm("/api/auth/callback/credentials", {
    csrfToken: csrf,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: "/incidents",
    json: "true",
  });
  console.log(`5. Credentials sign-in -> status=${signin.status}`);
  const hasSessionCookie = Object.keys(cookieJar).some((k) => k.startsWith("authjs.session-token"));
  console.log(`   session token cookie set: ${hasSessionCookie}`);

  // 6. Authenticated /incidents should be 200 (not redirected)
  const authed = await get("/incidents");
  console.log(`6. Authenticated /incidents -> status=${authed.status} (expect 200)`);

  // 7. Authenticated API should be 200
  const authedApi = await get("/api/incidents/search");
  const apiBody = await authedApi.text();
  console.log(`7. Authenticated /api/incidents/search -> status=${authedApi.status}, bodyLen=${apiBody.length}`);

  console.log("\n--- RESULTS ---");
  console.log(JSON.stringify({ redirectedToLogin, unauthApi: unauthApi.status, authedPage: authed.status, authedApi: authedApi.status }));
}

main()
  .catch((e) => console.error("ERR", e))
  .finally(() => prisma.$disconnect());

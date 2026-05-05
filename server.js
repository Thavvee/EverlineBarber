const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);
const tableName = process.env.DB_TABLE || "transactions";
const baseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
const lineChannelId = process.env.LINE_CHANNEL_ID;
const lineChannelSecret = process.env.LINE_CHANNEL_SECRET;
const sessionSecret = process.env.SESSION_SECRET || "change-this-session-secret";
const lineRedirectUri = process.env.LINE_REDIRECT_URI || `${baseUrl}/auth/line/callback`;
const distPath = path.join(__dirname, "dist");

if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
  throw new Error("DB_TABLE must contain only letters, numbers, and underscores");
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "everline_barber",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

app.use(
  session({
    name: "everline.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use(express.json());

function lineIsConfigured() {
  return Boolean(lineChannelId && lineChannelSecret);
}

function requireLineAuth(req, res, next) {
  if (req.session.lineUser) return next();

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "LINE login required" });
  }

  req.session.returnTo = req.originalUrl;
  return res.redirect("/login");
}

function renderLoginPage(message = "") {
  const setupMessage = lineIsConfigured()
    ? ""
    : `<p class="notice">ยังไม่ได้ตั้งค่า LINE_CHANNEL_ID และ LINE_CHANNEL_SECRET ในไฟล์ .env</p>`;

  return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LINE Login | Everline Barber</title>
    <style>
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        background: #f5f1e8;
        color: #1f2a24;
        font-family: Arial, sans-serif;
      }

      main {
        width: min(420px, calc(100% - 32px));
        padding: 32px;
        border: 1px solid #ddd3c2;
        border-radius: 8px;
        background: #fffaf2;
        box-shadow: 0 18px 50px rgba(41, 33, 22, 0.12);
      }

      h1 {
        margin: 0 0 10px;
        font-size: 28px;
      }

      p {
        margin: 0 0 20px;
        color: #5a625b;
        line-height: 1.6;
      }

      a,
      button {
        display: inline-flex;
        width: 100%;
        min-height: 48px;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        border: 0;
        border-radius: 6px;
        background: #06c755;
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        text-decoration: none;
      }

      .notice {
        padding: 12px;
        border-radius: 6px;
        background: #fff0d9;
        color: #7a4b00;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Everline Barber</h1>
      <p>กรุณาเข้าสู่ระบบด้วย LINE ก่อนใช้งาน Dashboard</p>
      ${setupMessage}
      ${message ? `<p class="notice">${message}</p>` : ""}
      <a href="/auth/line">Login with LINE</a>
    </main>
  </body>
</html>`;
}

app.get("/login", (req, res) => {
  if (req.session.lineUser) return res.redirect("/");
  return res.send(renderLoginPage());
});

app.get("/auth/line", (req, res) => {
  if (!lineIsConfigured()) {
    return res.status(500).send(renderLoginPage("ตั้งค่า LINE Login ให้ครบก่อนใช้งาน"));
  }

  const state = crypto.randomBytes(24).toString("hex");
  req.session.lineOAuthState = state;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: lineChannelId,
    redirect_uri: lineRedirectUri,
    state,
    scope: "profile openid",
  });

  return res.redirect(`https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`);
});

app.get("/auth/line/callback", async (req, res, next) => {
  try {
    if (req.query.error) {
      return res.status(401).send(renderLoginPage("ไม่สามารถเข้าสู่ระบบด้วย LINE ได้"));
    }

    if (!req.query.state || req.query.state !== req.session.lineOAuthState) {
      return res.status(400).send(renderLoginPage("LINE Login state ไม่ถูกต้อง"));
    }

    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(req.query.code || ""),
        redirect_uri: lineRedirectUri,
        client_id: lineChannelId,
        client_secret: lineChannelSecret,
      }),
    });

    if (!tokenResponse.ok) throw new Error("LINE token exchange failed");
    const token = await tokenResponse.json();

    const profileResponse = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (!profileResponse.ok) throw new Error("LINE profile request failed");
    const profile = await profileResponse.json();

    req.session.lineOAuthState = null;
    req.session.lineUser = {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl || "",
    };

    try {
      await pool.execute(
        `INSERT INTO users (line_user_id, name, picture_url)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           picture_url = VALUES(picture_url)`,
        [profile.userId, profile.displayName, profile.pictureUrl || null],
      );
      console.log(`[LINE LOGIN] User created/updated: ${profile.userId}`);
    } catch (dbError) {
      console.error("[LINE LOGIN ERROR] Failed to save user to database:", dbError.message);
    }

    const returnTo = req.session.returnTo || "/";
    req.session.returnTo = null;
    return res.redirect(returnTo);
  } catch (error) {
    return next(error);
  }
});

app.get("/api/me", requireLineAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT role FROM users WHERE line_user_id = ? LIMIT 1`,
      [req.session.lineUser.userId],
    );

    const role = rows[0]?.role || "customer";
    res.json({ user: { ...req.session.lineUser, role } });
  } catch (error) {
    next(error);
  }
});

app.post("/logout", requireLineAuth, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("everline.sid");
    return res.redirect("/login");
  });
});

app.get("/api/transactions", requireLineAuth, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          DATE_FORMAT(date, '%Y-%m-%d') AS date,
          item,
          CAST(price AS DECIMAL(12, 2)) AS price,
          payment,
          barber,
          COALESCE(note, '') AS note
        FROM \`${tableName}\`
        ORDER BY date DESC, id DESC
      `,
    );

    res.json(
      rows.map((row) => ({
        ...row,
        price: Number(row.price),
      })),
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/worktime", requireLineAuth, async (req, res, next) => {
  try {
    const { dates, times, type } = req.body;
    if (!dates || !Array.isArray(dates) || !times || !Array.isArray(times)) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const userId = req.session.lineUser.userId;
    const [userRows] = await pool.execute("SELECT id FROM users WHERE line_user_id = ?", [
      userId,
    ]);
    if (!userRows[0]) return res.status(401).json({ error: "User not found" });

    const user = userRows[0];
    const insertValues = [];

    for (const date of dates) {
      for (const time of times) {
        insertValues.push([user.id, date, time, type || "work"]);
      }
    }

    for (const [userId, date, time, workType] of insertValues) {
      await pool.execute(
        `INSERT INTO worktime (user_id, date, time, type)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE type = ?`,
        [userId, date, time, workType, workType],
      );
    }

    console.log(`[WORKTIME] User ${userId} recorded ${insertValues.length} entries`);
    res.json({ success: true, count: insertValues.length });
  } catch (error) {
    next(error);
  }
});

app.get("/api/worktime/dates/:date", requireLineAuth, async (req, res, next) => {
  try {
    const { date } = req.params;

    const [rows] = await pool.query(
      `
        SELECT
          u.id,
          u.name,
          GROUP_CONCAT(w.time ORDER BY w.time) AS times,
          w.type
        FROM worktime w
        JOIN users u ON w.user_id = u.id
        WHERE w.date = ?
        GROUP BY u.id, u.name, w.type
        ORDER BY u.name
      `,
      [date],
    );

    const worktime = {};
    for (const row of rows) {
      if (!worktime[row.id]) {
        worktime[row.id] = { name: row.name, work: [], leave: [] };
      }
      if (row.type === "leave") {
        worktime[row.id].leave = row.times ? row.times.split(",") : [];
      } else {
        worktime[row.id].work = row.times ? row.times.split(",") : [];
      }
    }

    res.json(worktime);
  } catch (error) {
    next(error);
  }
});

app.use(requireLineAuth);
app.use(express.static(distPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Database query failed" });
});

app.listen(port, () => {
  console.log(`Everline Barber dashboard running at http://localhost:${port}`);
});

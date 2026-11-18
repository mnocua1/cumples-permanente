// API del tablero de cumpleaños de Permanente para Cloudflare Pages.
// Guarda todo (registros, mensajes y fotos) en una base de datos D1 enlazada con el nombre DB.
// Variables opcionales del proyecto:
//   TEAM_CODE  -> clave que el equipo escribe una vez para entrar
//   ADMIN_CODE -> clave de administradora para borrar cualquier mensaje o persona

const json = (d, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const clean = (v, n) => String(v ?? "").trim().slice(0, n);
const ID = /^[a-f0-9]{16}$/;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FOTO = 1800 * 1024; // D1 guarda filas de hasta 2 MB
const fotoId = (v) => (typeof v === "string" && ID.test(v) ? v : null);

let ready = false;
async function setup(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS team (id TEXT PRIMARY KEY, token TEXT, name TEXT, day INTEGER, month INTEGER, verse TEXT, ref TEXT, photo TEXT, updated INTEGER)"),
    db.prepare("CREATE TABLE IF NOT EXISTS msgs (id TEXT PRIMARY KEY, token TEXT, dest TEXT, author TEXT, text TEXT, photo TEXT, at INTEGER)"),
    db.prepare("CREATE TABLE IF NOT EXISTS fotos (id TEXT PRIMARY KEY, type TEXT, data BLOB)"),
  ]);
  ready = true;
}
const toBytes = (d) =>
  d instanceof ArrayBuffer ? new Uint8Array(d) : ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : Uint8Array.from(d || []);

export async function onRequest({ request, env, params }) {
  const db = env.DB;
  if (!db) return json({ error: "Falta enlazar la base de datos D1 con el nombre DB (mira LEEME.md)." }, 500);
  const parts = [].concat(params.path || []);
  const [route, id] = parts;
  const method = request.method;
  const TEAM = env.TEAM_CODE || "";
  const ADMIN = env.ADMIN_CODE || "";
  const isAdmin = !!ADMIN && request.headers.get("x-admin") === ADMIN;

  try {
    await setup(db);

    // Las fotos se sirven por id aleatorio (las etiquetas <img> no pueden mandar la clave).
    if (method === "GET" && route === "foto") {
      if (!ID.test(id || "")) return new Response("No encontrada", { status: 404 });
      const row = await db.prepare("SELECT type, data FROM fotos WHERE id = ?").bind(id).first();
      if (!row) return new Response("No encontrada", { status: 404 });
      return new Response(toBytes(row.data), {
        headers: { "content-type": row.type || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
      });
    }

    if (TEAM && request.headers.get("x-clave") !== TEAM && !isAdmin) return json({ error: "clave" }, 401);

    if (method === "GET" && route === "data") {
      const [t, m] = await db.batch([
        db.prepare("SELECT id, name, day, month, verse, ref, photo, updated FROM team"),
        db.prepare("SELECT id, dest AS \"to\", author, text, photo, at FROM msgs ORDER BY at DESC"),
      ]);
      return json({ team: t.results, msgs: m.results, admin: isAdmin });
    }

    if (method === "POST" && route === "foto") {
      const type = (request.headers.get("content-type") || "").split(";")[0].trim();
      if (!TYPES.includes(type)) return json({ error: "Esa foto no es válida." }, 400);
      const buf = await request.arrayBuffer();
      if (!buf.byteLength) return json({ error: "Esa foto no es válida." }, 400);
      if (buf.byteLength > MAX_FOTO) return json({ error: "La foto es muy pesada. Prueba con otra." }, 413);
      const key = rid();
      await db.prepare("INSERT INTO fotos (id, type, data) VALUES (?, ?, ?)").bind(key, type, buf).run();
      return json({ id: key });
    }

    if (method === "POST" && route === "team") {
      const b = await request.json();
      const name = clean(b.name, 60);
      const day = Math.trunc(+b.day), month = Math.trunc(+b.month);
      if (!name) return json({ error: "Escribe tu nombre." }, 400);
      if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= new Date(2024, month, 0).getDate()))
        return json({ error: "Esa fecha no es válida." }, 400);
      let pid = b.id, token;
      if (pid) {
        if (!ID.test(pid)) return json({ error: "Registro no válido." }, 400);
        const prev = await db.prepare("SELECT token FROM team WHERE id = ?").bind(pid).first();
        if (!prev) return json({ error: "Ese registro ya no existe. Regístrate de nuevo." }, 404);
        if (prev.token !== b.token && !isAdmin) return json({ error: "Solo puedes editar tu propio registro." }, 403);
        token = prev.token;
      } else {
        pid = rid();
        token = rid() + rid();
      }
      await db
        .prepare("INSERT OR REPLACE INTO team (id, token, name, day, month, verse, ref, photo, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(pid, token, name, day, month, clean(b.verse, 600), clean(b.ref, 60), fotoId(b.photo), Date.now())
        .run();
      return json({ id: pid, token });
    }

    if (method === "POST" && route === "msgs") {
      const b = await request.json();
      const to = String(b.to || "");
      const text = clean(b.text, 1500), author = clean(b.author, 60);
      if (!ID.test(to) || !(await db.prepare("SELECT id FROM team WHERE id = ?").bind(to).first()))
        return json({ error: "Esa persona ya no está en el tablero." }, 404);
      if (!author) return json({ error: "Escribe tu nombre." }, 400);
      if (!text) return json({ error: "Escribe tu mensaje." }, 400);
      const mid = rid(), token = rid() + rid();
      await db
        .prepare("INSERT INTO msgs (id, token, dest, author, text, photo, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(mid, token, to, author, text, fotoId(b.photo), Date.now())
        .run();
      return json({ id: mid, token });
    }

    if (method === "DELETE" && (route === "msgs" || route === "team") && ID.test(id || "")) {
      const prev = await db.prepare(`SELECT token, photo FROM ${route} WHERE id = ?`).bind(id).first();
      if (!prev) return json({ ok: true });
      if (prev.token !== request.headers.get("x-token") && !isAdmin)
        return json({ error: "Solo puedes borrar lo que tú publicaste." }, 403);
      const ops = [db.prepare(`DELETE FROM ${route} WHERE id = ?`).bind(id)];
      if (prev.photo) ops.push(db.prepare("DELETE FROM fotos WHERE id = ?").bind(prev.photo));
      if (route === "team") {
        ops.push(db.prepare("DELETE FROM fotos WHERE id IN (SELECT photo FROM msgs WHERE dest = ? AND photo IS NOT NULL)").bind(id));
        ops.push(db.prepare("DELETE FROM msgs WHERE dest = ?").bind(id));
      }
      await db.batch(ops);
      return json({ ok: true });
    }

    return json({ error: "Ruta no encontrada." }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Error del servidor. Intenta de nuevo." }, 500);
  }
}

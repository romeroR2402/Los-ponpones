// Tienda de velas: la super administradora crea administradores con usuario,
// restablece contraseñas o elimina cuentas. Verifica el permiso aquí mismo.
// Desplegada en Supabase como "velas-usuarios" (verify_jwt desactivado: valida la sesión dentro).
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOMINIO = "usuarios.tienda-velas.app"; // correo interno: usuario@DOMINIO (nunca se envían correos)
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    const correo = (u?.user?.email || "").toLowerCase();
    if (!correo) return json({ error: "Inicia sesión" }, 401);
    const { data: yo } = await db.from("velas_admins").select("rol").eq("email", correo).maybeSingle();
    if (!yo || yo.rol !== "super") return json({ error: "Solo la super administradora puede hacer esto" }, 403);

    const b = await req.json().catch(() => ({}));
    const usuario = String(b.usuario || "").trim().toLowerCase();
    const pass = String(b.password || "");

    if (b.accion === "listar") {
      const { data } = await db.from("velas_admins").select("usuario,rol,debe_cambiar,creado").order("creado");
      return json({ ok: true, admins: (data || []).map((a) => ({ ...a, usuario: a.usuario || "(tú · super admin)" })) });
    }
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return json({ error: "Usuario de 3 a 30 letras o números, sin espacios" }, 400);
    const email = `${usuario}@${DOMINIO}`;

    if (b.accion === "crear") {
      if (pass.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
      const { data: c, error } = await db.auth.admin.createUser({ email, password: pass, email_confirm: true, user_metadata: { app: "velas-admin", usuario } });
      if (error) return json({ error: /already/i.test(error.message) ? "Ese usuario ya existe" : error.message }, 400);
      const { error: e2 } = await db.from("velas_admins").insert({ email, usuario, rol: "admin", debe_cambiar: true, user_id: c.user.id });
      if (e2) { await db.auth.admin.deleteUser(c.user.id); return json({ error: e2.message }, 400); }
      return json({ ok: true });
    }

    const { data: fila } = await db.from("velas_admins").select("*").eq("usuario", usuario).maybeSingle();
    if (!fila) return json({ error: "No existe ese usuario" }, 404);
    if (fila.rol === "super") return json({ error: "No se puede modificar a la super administradora" }, 400);

    if (b.accion === "restablecer") {
      if (pass.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
      const { error } = await db.auth.admin.updateUserById(fila.user_id, { password: pass });
      if (error) return json({ error: error.message }, 400);
      await db.from("velas_admins").update({ debe_cambiar: true }).eq("usuario", usuario);
      return json({ ok: true });
    }
    if (b.accion === "eliminar") {
      await db.from("velas_admins").delete().eq("usuario", usuario);
      if (fila.user_id) await db.auth.admin.deleteUser(fila.user_id);
      return json({ ok: true });
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

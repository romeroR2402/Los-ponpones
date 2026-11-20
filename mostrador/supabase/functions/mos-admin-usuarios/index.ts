// Mostrador · el dueño de la plataforma (super admin) crea accesos para sus clientes
// y les restablece la contraseña. Verifica el permiso aquí mismo contra mos_superadmins.
// Desplegada en Supabase como "mos-admin-usuarios" (verify_jwt desactivado: valida la sesión dentro).
import { createClient } from "jsr:@supabase/supabase-js@2";

const DOMINIO = "usuarios.mostrador.app"; // si el cliente no tiene correo: usuario@DOMINIO (nunca se envían correos)
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
    const { data: yo } = await db.from("mos_superadmins").select("email").eq("email", correo).maybeSingle();
    if (!yo) return json({ error: "Sólo el administrador de la plataforma puede hacer esto" }, 403);

    const b = await req.json().catch(() => ({}));
    const pass = String(b.password || "");
    if (pass.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);

    if (b.accion === "crear") {
      let email = String(b.email || "").trim().toLowerCase();
      if (!email.includes("@")) {
        if (!/^[a-z0-9._-]{3,30}$/.test(email)) return json({ error: "Escribe un correo, o un usuario de 3 a 30 letras o números sin espacios" }, 400);
        email = `${email}@${DOMINIO}`;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Revisa el correo" }, 400);
      const nombre = String(b.nombre || "").trim().slice(0, 80);
      const { data: c, error } = await db.auth.admin.createUser({
        email, password: pass, email_confirm: true, user_metadata: { nombre, app: "mostrador", creado_por_admin: true },
      });
      if (error) return json({ error: /already|registered|exists/i.test(error.message) ? "Ese correo ya tiene cuenta" : error.message }, 400);
      return json({ ok: true, email, user_id: c.user.id });
    }

    if (b.accion === "restablecer") {
      const id = String(b.user_id || "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Falta el usuario" }, 400);
      const { data: objetivo } = await db.auth.admin.getUserById(id);
      const e = (objetivo?.user?.email || "").toLowerCase();
      if (!e) return json({ error: "No existe ese usuario" }, 404);
      const { data: esAdmin } = await db.from("mos_superadmins").select("email").eq("email", e).maybeSingle();
      if (esAdmin || e === "demo@usuarios.mostrador.app") return json({ error: "Esa cuenta no se puede modificar desde aquí" }, 400);
      const { error } = await db.auth.admin.updateUserById(id, { password: pass });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, email: e });
    }
    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

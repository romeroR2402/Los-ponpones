// Mostrador · registro de tiendas nuevas.
// En el proyecto de Supabase el registro general está cerrado (protege las otras tiendas del proyecto),
// así que las cuentas de Mostrador se crean aquí con la llave de servicio, ya confirmadas.
// Protección: datos validados y límite de registros por hora (por IP y en total).
// Desplegada como "mos-registro" (verify_jwt desactivado: es para gente que todavía no tiene cuenta).
import { createClient } from "jsr:@supabase/supabase-js@2";

const POR_IP_HORA = 5, TOTAL_HORA = 60;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const b = await req.json().catch(() => ({}));
    const email = String(b.email || "").trim().toLowerCase();
    const pass = String(b.password || "");
    const nombre = String(b.nombre || "").trim().slice(0, 80);
    if (!nombre) return json({ error: "Escribe tu nombre" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return json({ error: "Revisa tu correo" }, 400);
    if (/@usuarios\.(mostrador|tienda-velas)\.app$/.test(email)) return json({ error: "Usa tu correo personal" }, 400);
    if (pass.length < 6 || pass.length > 72) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "sin-ip";
    const hace1h = new Date(Date.now() - 3600_000).toISOString();
    const [{ count: porIp }, { count: total }] = await Promise.all([
      db.from("mos_registros").select("id", { count: "exact", head: true }).eq("ip", ip).gte("creado", hace1h),
      db.from("mos_registros").select("id", { count: "exact", head: true }).gte("creado", hace1h),
    ]);
    if ((porIp ?? 0) >= POR_IP_HORA || (total ?? 0) >= TOTAL_HORA) return json({ error: "Demasiados registros seguidos. Intenta en una hora." }, 429);

    const { data: c, error } = await db.auth.admin.createUser({
      email, password: pass, email_confirm: true, user_metadata: { nombre, app: "mostrador" },
    });
    if (error) return json({ error: /already|registered|exists/i.test(error.message) ? "Ese correo ya tiene cuenta. Toca “Entrar”." : error.message }, 400);
    await db.from("mos_registros").insert({ ip, email });
    return json({ ok: true, user_id: c.user.id });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

// Mostrador · registro de tiendas nuevas con verificación de correo.
// En el proyecto de Supabase el registro general está cerrado (protege las otras tiendas del proyecto),
// así que las cuentas de Mostrador se crean aquí con la llave de servicio.
//
// Verificación: se manda un código de 6 dígitos al correo (SMTP, p. ej. Gmail con "contraseña de aplicación").
// Secretos de la función (Supabase → Edge Functions → Secrets):
//   SMTP_USER  = tu correo de Gmail          SMTP_PASS = contraseña de aplicación de 16 letras
//   (opcionales) SMTP_HOST = smtp.gmail.com  SMTP_PORT = 465  SMTP_NOMBRE = Mostrador
// Si los secretos no están puestos, la cuenta se crea ya confirmada (modo sin verificación).
//
// Acciones: registrar {nombre,email,password} · reenviar {email} · verificar {email,codigo} · estado {}
// Protección: datos validados, límite por hora (IP y total), código de 15 min con 5 intentos, reenvío cada 60 s.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const POR_IP_HORA = 5, TOTAL_HORA = 60, MIN_CODIGO = 15, MAX_INTENTOS = 5, MAX_ENVIOS_HORA = 5;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => (Deno.env.get(k) || "").trim();
const correoListo = () => !!(env("SMTP_USER") && env("SMTP_PASS"));

async function sha(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function nuevoCodigo() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}
async function enviarCodigo(email: string, nombre: string, codigo: string) {
  const c = new SMTPClient({
    connection: { hostname: env("SMTP_HOST") || "smtp.gmail.com", port: Number(env("SMTP_PORT") || 465), tls: true,
      auth: { username: env("SMTP_USER"), password: env("SMTP_PASS").replace(/\s+/g, "") } },
  });
  const quien = env("SMTP_NOMBRE") || "Mostrador";
  const hola = nombre ? `Hola ${nombre.split(" ")[0]},` : "Hola,";
  await c.send({
    from: `${quien} <${env("SMTP_USER")}>`, to: email, subject: `${codigo} es tu código de ${quien}`,
    content: `${hola}\n\nTu código para activar tu cuenta de ${quien} es: ${codigo}\n\nVence en ${MIN_CODIGO} minutos. Si tú no te registraste, ignora este correo.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto;padding:24px;color:#1c2420">
      <div style="display:inline-block;background:#1f9a55;color:#fff;font-weight:700;padding:8px 12px;border-radius:10px">${quien}</div>
      <p style="font-size:16px;margin:20px 0 8px">${hola}</p>
      <p style="font-size:15px;color:#56605b;margin:0 0 16px">Escribe este código en la app para activar tu cuenta:</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#eaf6ef;color:#1f9a55;text-align:center;padding:16px;border-radius:12px">${codigo}</div>
      <p style="font-size:13px;color:#8a938e;margin-top:16px">Vence en ${MIN_CODIGO} minutos. Si tú no te registraste, ignora este correo.</p></div>`,
  });
  await c.close();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const b = await req.json().catch(() => ({}));
    const accion = String(b.accion || "registrar");
    const email = String(b.email || "").trim().toLowerCase();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "sin-ip";

    if (accion === "estado") return json({ ok: true, verificacion: correoListo() });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return json({ error: "Revisa tu correo" }, 400);

    // Busca la cuenta por correo (para reenviar o verificar)
    const buscar = async () => {
      const { data } = await db.from("mos_verificaciones").select("*").eq("email", email).maybeSingle();
      return data as null | { user_id: string; codigo_hash: string; expira: string; intentos: number; enviados: number; ultimo_envio: string };
    };
    const mandar = async (userId: string, nombre: string) => {
      const codigo = nuevoCodigo();
      const prev = await buscar();
      const dentroHora = prev && Date.now() - new Date(prev.ultimo_envio).getTime() < 3600_000;
      if (prev && Date.now() - new Date(prev.ultimo_envio).getTime() < 60_000) return { error: "Espera un minuto para pedir otro código", s: 429 };
      if (prev && dentroHora && prev.enviados >= MAX_ENVIOS_HORA) return { error: "Ya pediste muchos códigos. Intenta en una hora.", s: 429 };
      await db.from("mos_verificaciones").upsert({
        email, user_id: userId, codigo_hash: await sha(email + ":" + codigo), expira: new Date(Date.now() + MIN_CODIGO * 60_000).toISOString(),
        intentos: 0, enviados: dentroHora ? (prev!.enviados + 1) : 1, ultimo_envio: new Date().toISOString(),
      });
      try { await enviarCodigo(email, nombre, codigo) }
      catch (e) { console.error("SMTP", e); return { error: "No pudimos enviar el correo. Revisa que el correo esté bien escrito o intenta más tarde.", s: 502 } }
      return null;
    };

    if (accion === "registrar") {
      const pass = String(b.password || "");
      const nombre = String(b.nombre || "").trim().slice(0, 80);
      if (!nombre) return json({ error: "Escribe tu nombre" }, 400);
      if (/@usuarios\.(mostrador|tienda-velas)\.app$/.test(email)) return json({ error: "Usa tu correo personal" }, 400);
      if (pass.length < 6 || pass.length > 72) return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
      const hace1h = new Date(Date.now() - 3600_000).toISOString();
      const [{ count: porIp }, { count: total }] = await Promise.all([
        db.from("mos_registros").select("id", { count: "exact", head: true }).eq("ip", ip).gte("creado", hace1h),
        db.from("mos_registros").select("id", { count: "exact", head: true }).gte("creado", hace1h),
      ]);
      if ((porIp ?? 0) >= POR_IP_HORA || (total ?? 0) >= TOTAL_HORA) return json({ error: "Demasiados registros seguidos. Intenta en una hora." }, 429);

      const verificar = correoListo();
      const { data: c, error } = await db.auth.admin.createUser({
        email, password: pass, email_confirm: !verificar, user_metadata: { nombre, app: "mostrador" },
      });
      let userId = c?.user?.id || "";
      if (error) {
        if (!/already|registered|exists/i.test(error.message)) return json({ error: error.message }, 400);
        // ¿Ya existe pero sin confirmar? Se actualiza la contraseña y se manda otro código (sin el código no hay acceso).
        const pend = await buscar();
        if (!verificar || !pend) return json({ error: "Ese correo ya tiene cuenta. Toca “Entrar”." }, 400);
        const { data: u } = await db.auth.admin.getUserById(pend.user_id);
        if (!u?.user || u.user.email_confirmed_at) return json({ error: "Ese correo ya tiene cuenta. Toca “Entrar”." }, 400);
        await db.auth.admin.updateUserById(pend.user_id, { password: pass, user_metadata: { nombre, app: "mostrador" } });
        userId = pend.user_id;
      }
      await db.from("mos_registros").insert({ ip, email });
      if (!verificar) return json({ ok: true, verificar: false });
      const e = await mandar(userId, nombre);
      if (e) return json({ error: e.error, verificar: true }, e.s);
      return json({ ok: true, verificar: true });
    }

    if (accion === "reenviar") {
      if (!correoListo()) return json({ error: "La verificación por correo no está activa" }, 400);
      const pend = await buscar();
      if (!pend) return json({ error: "No hay un registro pendiente con ese correo. Crea tu cuenta otra vez." }, 404);
      const { data: u } = await db.auth.admin.getUserById(pend.user_id);
      if (!u?.user) return json({ error: "No hay un registro pendiente con ese correo." }, 404);
      if (u.user.email_confirmed_at) return json({ ok: true, ya: true });
      const e = await mandar(pend.user_id, String(u.user.user_metadata?.nombre || ""));
      if (e) return json({ error: e.error }, e.s);
      return json({ ok: true });
    }

    if (accion === "verificar") {
      const codigo = String(b.codigo || "").replace(/\D/g, "");
      if (codigo.length !== 6) return json({ error: "El código tiene 6 números" }, 400);
      const pend = await buscar();
      if (!pend) return json({ error: "No hay un código pendiente para ese correo. Pide uno nuevo." }, 404);
      if (pend.intentos >= MAX_INTENTOS) return json({ error: "Demasiados intentos. Pide un código nuevo." }, 429);
      if (new Date(pend.expira).getTime() < Date.now()) return json({ error: "El código ya venció. Pide uno nuevo." }, 400);
      if (await sha(email + ":" + codigo) !== pend.codigo_hash) {
        await db.from("mos_verificaciones").update({ intentos: pend.intentos + 1 }).eq("email", email);
        return json({ error: "Código incorrecto. Te quedan " + (MAX_INTENTOS - pend.intentos - 1) + " intentos." }, 400);
      }
      const { error } = await db.auth.admin.updateUserById(pend.user_id, { email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      await db.from("mos_verificaciones").delete().eq("email", email);
      return json({ ok: true });
    }
    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

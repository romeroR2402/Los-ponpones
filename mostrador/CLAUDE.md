# Mostrador — plataforma de gestión multi-giro para comercios en México

- Stack (decisión del dueño: "igual que Los Ponpones"): HTML + CSS + JS sin compilar, PWA, Supabase (tablas `mos_`),
  GitHub Pages en `romeroR2402/Los-ponpones/mostrador/`. React queda como migración opcional futura.
- Archivos: `js/giros.js` (plantillas de giro = datos), `js/core.js` (plataforma), `js/app.js` (pantallas), `supabase/mostrador.sql`.
- Propuesta y arquitectura: `docs/propuesta-arquitectura.md` · Flujo entre skills: `docs/FLUJO-DE-TRABAJO.md`
  (ux-ui-designer → react-developer (frontend) → qa-tester → corrección → revisión UX → QA final).
- Nunca condicionar por giro (`giro === …`); usar capacidades (`M.tiene('caducidad')`).
- Toda función SQL que revise rol usa `coalesce(mos_rol(x), '')` (ver BUG-0001).
- Después de cambiar SQL: correr `get_advisors` y la prueba de aislamiento; después de cambiar pantallas: `qa/e2e.js`.
- Al cambiar archivos de la app, subir la versión de caché en `sw.js` (`mostrador-vN`).
- Idioma de la UI y la documentación: español de México.

# Matriz base de pruebas (copiar a 03-qa.md y ajustar)

| # | Caso | Giro | Rol | Viewport | Tipo | Resultado |
|---|---|---|---|---|---|---|
| 1 | Camino feliz | abarrotes | dueño | 360 | funcional | |
| 2 | Camino feliz | farmacia / tlapalería | cajero | 1280 | funcional | |
| 3 | Elementos ocultos si la capacidad no aplica | papelería | dueño | 360 | config | |
| 4 | Desactivar módulo con datos existentes | abarrotes | dueño | 1280 | config | |
| 5 | Acceso por URL a dato de otro negocio | cualquiera | cajero | — | seguridad | |
| 6 | Permiso denegado para el rol | cualquiera | cajero | 360 | permisos | |
| 7 | Validaciones de formulario (vacío, límites, decimales) | cualquiera | dueño | 360 | formulario | |
| 8 | Sin conexión → reconectar | abarrotes | cajero | 360 | offline | |
| 9 | Estados vacío / carga / error | cualquiera | — | 360 | UI | |
| 10 | Texto largo / ñ / acentos | cualquiera | — | 360 | UI | |
| 11 | Navegación atrás / recarga a mitad del flujo | cualquiera | — | 360 | navegación | |
| 12 | Regresión: venta, entrada de mercancía, alertas | todos | — | 360 | regresión | |

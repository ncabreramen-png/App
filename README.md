# Reportes de obra — Proyecto Chilama

Aplicación web responsive (mobile-first) para que el equipo de supervisión
registre reportes desde el campo y el gerente vea el estatus de obra
consolidado en tiempo real.

Proyecto: planta de tratamiento de aguas residuales (PTAR) y alcantarillado
sanitario.

## Stack

- **Next.js 15** (App Router, React 19, Server Components y Server Actions)
- **Supabase**: Postgres + Auth + Storage
- **Tailwind CSS**
- **Resend** para las notificaciones por correo (opcional)
- Preparado para desplegar en **Vercel**

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Abrir **SQL Editor** y ejecutar el contenido completo de
   [`supabase/schema.sql`](supabase/schema.sql).

Ese script crea los tipos, las tablas, las políticas de RLS, los triggers, la
vista del semáforo, el bucket privado de fotos y **precarga los 12 frentes de
trabajo**. Es idempotente: se puede volver a correr sin duplicar nada.

### 2. Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

| Variable | Para qué sirve | Obligatoria |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto (Settings → API) | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anon | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Alta de usuarios y envío de correos al gerente | Sí en la práctica |
| `NEXT_PUBLIC_SITE_URL` | Base de los links que van en los correos | Sí |
| `RESEND_API_KEY` | Envío de correos | No |
| `CORREO_REMITENTE` | Remitente de los correos | No |

`SUPABASE_SERVICE_ROLE_KEY` **nunca** debe llevar el prefijo `NEXT_PUBLIC_`:
se usa solo en el servidor.

Sin `RESEND_API_KEY` la app funciona igual, pero no manda correos: el reporte
se guarda y se avisa en pantalla que la notificación no salió.

### 3. Crear el primer gerente

El alta de usuarios se hace desde la pantalla **Usuarios** del gerente, pero
para el primero hay que usar Supabase directamente:

1. **Authentication → Users → Add user**, con "Auto Confirm User" activado.
2. En **User Metadata** poner:

```json
{ "nombre": "Nombre Apellido", "disciplina": "Calidad", "rol": "Gerente" }
```

Un trigger (`handle_new_user`) crea automáticamente la fila en
`public.usuarios` a partir de esos metadatos. A partir de ahí, ese gerente
puede dar de alta al resto del equipo desde la app.

### 4. Correr en local

```bash
npm install
npm run dev
```

### 5. Desplegar en Vercel

1. Importar el repositorio en Vercel.
2. Cargar las mismas variables de entorno del paso 2, con
   `NEXT_PUBLIC_SITE_URL` apuntando al dominio de producción.
3. Desplegar. No hace falta configuración extra: el build es el estándar de
   Next.js.

## Roles

| Rol | Qué ve |
|---|---|
| **Campo** | Solo sus propios reportes. Crea reportes nuevos. |
| **Gerente** | Dashboard de los 12 frentes, aprobaciones, todos los reportes, informe y usuarios. |

El aislamiento no depende del frontend: las políticas de RLS de Postgres
filtran por `auth.uid()`, así que un profesional de campo no puede leer
reportes ajenos ni siquiera consultando la API directamente.

## Reglas de negocio implementadas

1. **Estatus inicial.** Un reporte de tipo *Orden de cambio* nace `Pendiente`;
   los demás nacen `Registrado`. Lo decide un trigger en la base
   (`reportes_estatus_inicial`), no el cliente.
2. **Aprobación.** El gerente aprueba o rechaza las órdenes pendientes. El
   rechazo exige comentario, validado en la acción del servidor y también por
   un trigger.
3. **Semáforo por frente.** Cuenta los reportes de tipo *Problemática* o con
   estatus *Rechazado*: 0 → **A tiempo** (verde), 1 → **Atraso leve**
   (amarillo), 2 o más → **Crítico** (rojo). Se calcula en la vista
   `frentes_semaforo`.
4. **Notificación por correo.** Al crear un reporte de tipo *Orden de cambio*
   o *Problemática* se envía un correo a todos los usuarios con rol Gerente,
   con el resumen y un link directo a `/reportes/<id>`.
5. **Aislamiento por usuario.** Ver la tabla de roles.

## Pantallas

- `/login` — ingreso por correo y contraseña.
- `/campo` — mis reportes.
- `/campo/nuevo` — formulario: frente, tipo, descripción y fotos (cámara o
  galería). La descripción vacía bloquea el envío.
- `/gerente` — dashboard con el semáforo de los 12 frentes y sus avances
  físico y financiero (editables).
- `/gerente/aprobaciones` — cola de órdenes de cambio pendientes.
- `/gerente/reportes` — todos los reportes, filtrables por frente,
  disciplina, tipo y estatus.
- `/gerente/informe` — informe de estatus agrupado por frente principal
  (Colectores / Estaciones de bombeo / PTAR), con hoja de estilos de
  impresión para exportar a PDF.
- `/gerente/usuarios` — alta y listado del equipo.
- `/reportes/[id]` — detalle de un reporte; es el destino de los links de los
  correos.

## Frentes de trabajo precargados

**Colectores:** Frente 1 Conchalios · Frente 2 Chilama oeste · Frente 3
Chilama norte la danta-el obispo

**Estaciones de bombeo:** Frente 1 Planta el obispo · Frente 2 El cementerio ·
Frente 3 Chilama 2 norte · Frente 4 Chilama oeste · Frente 5 Conchalio

**PTAR:** Electromecánico · Eléctrico · Civil · Hidráulico

## Fotos

El bucket `reportes-fotos` es **privado**. Las imágenes se comprimen en el
celular antes de subirse (lado máximo 1600 px, JPEG) para que el envío sea
rápido con mala señal, y se muestran con URLs firmadas de una hora generadas
en el servidor con la sesión del usuario.

## Notas de diseño

- La disciplina del reporte se toma del perfil de quien lo crea, no se elige
  en el formulario: así el reporte de campo se completa en menos de un minuto.
- Los avances físico y financiero se cargan a mano desde el dashboard del
  gerente. **No** se derivan de los reportes: no hay en el modelo de datos una
  fuente que permita calcularlos.
- La vista `frentes_semaforo` usa `security_invoker`, es decir respeta el RLS
  de quien la consulta. Solo el gerente ve el conteo completo, y solo las
  pantallas del gerente la usan.

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run start      # servir el build
npm run lint       # ESLint
npm run typecheck  # TypeScript
```

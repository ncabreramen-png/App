# Reportes de obra — Proyecto Chilama

Aplicación web responsive (mobile-first) para que el equipo de supervisión
registre reportes desde el campo y la gerencia vea el estatus de obra
consolidado en tiempo real.

Proyecto: planta de tratamiento de aguas residuales (PTAR) y alcantarillado
sanitario.

## Stack

- **Next.js 15** (App Router, React 19, Server Components y Server Actions)
- **Supabase**: Postgres + Auth + Storage, con Row Level Security
- **Tailwind CSS**
- **Resend** para las notificaciones por correo (opcional)
- Preparado para desplegar en **Vercel**

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Abrir **SQL Editor** y ejecutar el contenido completo de
   [`supabase/schema.sql`](supabase/schema.sql).

Ese script crea los tipos, las tablas, las políticas de RLS, los triggers, las
vistas, las funciones de la curva, los buckets privados y **precarga los 12
frentes de trabajo**. Es idempotente: se puede volver a correr sin duplicar
nada.

La carpeta [`supabase/migraciones/`](supabase/migraciones) tiene los cambios
incrementales, numerados y también idempotentes. Sirven para una base que ya
está en uso: se corre solo la que falta, en vez del esquema entero. El
esquema maestro siempre refleja el estado final.

### 2. Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

| Variable | Para qué sirve | Obligatoria |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto (Settings → API) | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anon | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Alta y borrado de usuarios, cambio de contraseñas y envío de correos | Sí en la práctica |
| `NEXT_PUBLIC_SITE_URL` | Base de los links que van en los correos | Sí |
| `RESEND_API_KEY` | Envío de correos | No |
| `CORREO_REMITENTE` | Remitente de los correos | No |

`SUPABASE_SERVICE_ROLE_KEY` **nunca** debe llevar el prefijo `NEXT_PUBLIC_`:
se usa solo en el servidor.

Sin `RESEND_API_KEY` la app funciona igual, pero no manda correos: el reporte
se guarda y se avisa en pantalla que la notificación no salió. Resend además
exige un dominio verificado para el remitente.

### 3. Crear el primer gerente

El alta de usuarios se hace desde la pantalla **Usuarios** del gerente, pero
para el primero hay que usar Supabase directamente:

1. **Authentication → Users → Add user**, con "Auto Confirm User" activado.
2. En **User Metadata** poner:

```json
{ "nombre": "Nombre Apellido", "disciplina": "Aseguramiento de calidad", "rol": "Gerente" }
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

## Perfiles

Un perfil son dos cosas: el **rol**, que decide el alcance, y la
**disciplina**, que decide qué pantallas especializadas ve.

| Rol | Qué ve |
|---|---|
| **Campo** | Solo sus propios reportes (y los de quien haya sustituido). Crea reportes nuevos. |
| **Gerente** | Todo: dashboard de los 12 frentes, aprobaciones, reportes, cronograma, cierre mensual, curva, análisis, no conformidades, administración, informe y usuarios. |

El aislamiento no depende del frontend: las políticas de RLS de Postgres
filtran por `auth.uid()`, así que un profesional de campo no puede leer
reportes ajenos ni siquiera consultando la API directamente.

### Disciplinas

**Por frente de obra**, reportan lo que ven en su especialidad:
Hidráulico · Estructural · Civil · Mecánico · Eléctrico · Geotecnia

**Transversales**, reportan sobre cualquier frente:
Medio ambiente · Seguridad y salud ocupacional · Gestión social ·
Aseguramiento de calidad

**Administración**, no reporta por frente: informa el corte mensual del
contrato.

Dos disciplinas abren pantallas propias, y en los dos casos **el rol Gerente
queda fuera de la escritura aunque tenga esa disciplina**, porque para la
gerencia esas pantallas son de solo lectura:

- **Aseguramiento de calidad** → levanta y cierra no conformidades.
- **Administración** → carga el corte mensual del contrato.

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

### Campo

- `/login` — ingreso por correo y contraseña.
- `/campo` — mis reportes.
- `/campo/nuevo` — formulario: frente, tipo, descripción y adjuntos (cámara,
  galería o archivo). La descripción vacía bloquea el envío.
- `/reportes/[id]` — detalle de un reporte; es el destino de los links de los
  correos.

### Gerencia

- `/gerente` — dashboard con el semáforo de los 12 frentes y sus avances
  físico y financiero.
- `/gerente/aprobaciones` — cola de órdenes de cambio pendientes.
- `/gerente/reportes` — todos los reportes, filtrables por frente,
  disciplina, tipo y estatus. Desde el detalle se pueden **corregir y borrar**.
- `/gerente/gantt` — cronograma de tareas por frente. Ver *Cómo se calcula el
  avance*.
- `/gerente/cierre` — cierre mensual: el avance acumulado de cada tarea al
  cierre del mes.
- `/gerente/curva` — curva S del proyecto, programado contra real.
- `/gerente/informe` — informe de estatus agrupado por frente principal
  (Colectores / Estaciones de bombeo / PTAR), con hoja de estilos de
  impresión para exportar a PDF. Incluye las no conformidades y el corte de
  administración.
- `/gerente/usuarios` — alta y gestión del equipo.

### Compartidas

- `/analisis` — análisis de gerencia. Los crea el gerente con adjuntos de
  cualquier tipo y nacen **privados**; se comparten eligiendo usuarios uno por
  uno. Quien los recibe los ve en esta misma pantalla, en modo lectura.
- `/no-conformidad` — las levanta y las cierra **aseguramiento de calidad**,
  con su frente, descripción, adjuntos y un correlativo (`NC-001`). Cerrar una
  exige decir cómo se atendió, y reabrirla limpia ese cierre: dejar la fecha
  anterior mentiría. La gerencia la ve en modo lectura, en pantalla y en el
  informe.
- `/administracion` — corte mensual del contrato, para todo el proyecto:
  avance programado y real, avance financiero (monto y porcentaje) y
  estimaciones **autorizadas** y **pagadas**, con su cantidad e importe. Hay
  **un corte por mes** y las cantidades e importes son **acumulados** al
  cierre. Lo carga el perfil de disciplina *Administración*; la gerencia lo ve
  en modo lectura y aparece en el informe. Las cifras **no** tocan la curva
  del proyecto, para no dejar tres fuentes escribiendo los mismos meses.

## Frentes de trabajo precargados

**Colectores:** Frente 1 Conchalios · Frente 2 Chilama oeste · Frente 3
Chilama norte la danta-el obispo

**Estaciones de bombeo:** Frente 1 Planta el obispo · Frente 2 El cementerio ·
Frente 3 Chilama 2 norte · Frente 4 Chilama oeste · Frente 5 Conchalio

**PTAR:** Electromecánico · Eléctrico · Civil · Hidráulico

## Cómo se calcula el avance

El cronograma es la fuente. La cadena es **tareas → mediciones mensuales →
curva**, y conviene entenderla porque es lo menos obvio de la app.

### 1. Tareas (`/gerente/gantt`)

Cada tarea pertenece a un frente y tiene nombre, inicio, fin y un peso
opcional. Sin peso, pesa lo que dura: la aritmética las pondera por días, de
modo que una excavación de dos meses no vale lo mismo que una inspección de
dos días.

Hay carga masiva pegando una línea por tarea, separada por `|`:

```
Frente 1 Conchalios | Excavación tramo 1-2 | 2026-04-01 | 2026-05-15 | 30
```

Las columnas son `Frente | Tarea | Inicio | Fin | Avance`. El avance es
opcional.

**Cuando un frente tiene tareas, su avance físico sale del cronograma** y deja
de editarse a mano en el dashboard; la vista `frentes_semaforo` lo calcula
ponderado. Un frente sin tareas conserva el valor que se le cargó a mano.

### 2. Cierre mensual (`/gerente/cierre`)

Cada mes se registra el **avance acumulado de cada tarea al cierre**, no lo
avanzado en el mes. Los campos vienen precargados con lo que traía el mes
anterior, y el formulario no deja guardar un valor que retroceda por debajo
de eso.

Guardar un porcentaje por tarea y por mes es lo que permite reconstruir la
curva real hacia atrás. Una tarea que no se midió en un mes conserva lo que
llevaba en el anterior, que es justamente lo que significa un avance
acumulado.

### 3. Curva del proyecto (`/gerente/curva`)

La curva S del proyecto, mes a mes, programado contra real, con el desvío al
último mes medido. Los meses se pueden cargar a mano, de a uno o en masa:

```
2026-04  0.0  0.0
2026-05  0.1  0.1
2026-06  0.2  -
```

Separador: espacios, coma, punto y coma o tabulación. El avance real admite
`-` o venir vacío cuando el mes todavía no se midió; cargar `0` dibuja una
caída a cero en vez de cortar la línea.

Desde el cronograma, el botón **Actualizar curva desde el Gantt** recalcula el
avance programado de todos los meses a partir de las fechas de las tareas y
sella el avance real de hoy en el mes corriente. Los meses anteriores
conservan su valor.

## Gestión de usuarios

Todo desde `/gerente/usuarios`, solo la gerencia:

- **Editar** nombre, disciplina y rol.
- **Contraseña**: no hay recuperación por correo, así que cuando alguien la
  olvida la gerencia le asigna una nueva (mínimo 8 caracteres) y se la
  entrega.
- **Desactivar**: le corta el acceso y conserva su historial firmado por él.
  El corte es inmediato, no espera a que expire el token.
- **Borrar**: solo está disponible para quien no dejó historial. Eliminar a
  alguien con reportes o análisis a su nombre los dejaría sin autor.
- **Sustituir**: registra el relevo de un profesional por otro en la misma
  disciplina. El sucesor **ve y continúa todo el historial** del anterior, y
  al anterior se le corta el acceso en la misma operación. La firma de cada
  reporte **no** cambia: un reporte dice quién observó qué y cuándo, y
  reasignarlo haría que el registro afirme que el sucesor vio cosas que no
  vio. El relevo se encadena: si A fue sustituido por B y B por C, C ve
  también lo de A.

## Adjuntos

Cualquier perfil puede adjuntar **fotos, PDF, Excel, Word y PowerPoint**. Las
imágenes se comprimen en el celular antes de subirse (lado máximo 1600 px,
JPEG) para que el envío sea rápido con mala señal; los documentos se suben tal
cual, porque recomprimirlos los rompería. Las imágenes se muestran como
miniatura y el resto como archivo descargable.

El tipo se valida por extensión además de por tipo MIME: en Android es común
que un `.xlsx` llegue como `application/octet-stream` y sería rechazado sin
motivo.

Los buckets son todos **privados**, servidos con URLs firmadas de una hora
generadas con la sesión del usuario:

| Bucket | Para qué | Tope por archivo |
|---|---|---|
| `reportes-fotos` | adjuntos de los reportes de campo | 25 MB |
| `analisis-archivos` | adjuntos de los análisis de gerencia | 50 MB |
| `nc-archivos` | adjuntos de las no conformidades | 25 MB |
| `admin-archivos` | adjuntos de los cortes de administración | 25 MB |

La ruta de un análisis es `<usuario>/<análisis>/<archivo>`, de modo que el
permiso de lectura de quien lo recibe se resuelve mirando la carpeta: el
aislamiento vale también para los archivos, no solo para las filas.

## Instalarla en el teléfono

La app trae manifiesto e iconos, así que desde el navegador se puede
**Agregar a pantalla de inicio** y queda como una aplicación más, sin la barra
del navegador y con la barra de estado en el azul de la marca.

Los iconos se cachean con fuerza: después de un despliegue que los cambie,
puede hacer falta cerrar y volver a abrir la pestaña, o borrar el acceso
directo viejo y volver a agregarlo.

## Notas de diseño

- La disciplina del reporte se toma del perfil de quien lo crea, no se elige
  en el formulario: así el reporte de campo se completa en menos de un minuto.
- El avance físico de un frente sale del cronograma cuando tiene tareas, y se
  carga a mano cuando no. El avance financiero por frente siempre se carga a
  mano desde el dashboard.
- Las mediciones mensuales alimentan la curva, pero la curva **no** vuelve a
  escribir las mediciones. La sincronización es en un solo sentido a
  propósito: cuando era bidireccional, crear una tarea sellaba un 0% en el mes
  corriente y borraba el acumulado.
- La vista `frentes_semaforo` usa `security_invoker`, es decir respeta el RLS
  de quien la consulta. Solo el gerente ve el conteo completo.
- Las funciones de permiso (`es_gerente`, `es_calidad`, `es_administracion`,
  `puede_ver_analisis`, `predecesores`) son `SECURITY DEFINER` para poder
  leerse desde las policies sin recursión de RLS.
- Las guardas que reciben una carpeta de Storage la comparan como texto. Un
  nombre mal formado haría fallar el *cast* a `uuid` dentro de la policy en
  vez de denegar el acceso.

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run start      # servir el build
npm run lint       # ESLint
npm run typecheck  # TypeScript
```

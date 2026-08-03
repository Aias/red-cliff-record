

# Red Cliff Record

Un repositorio personal de conocimiento que agrega datos de múltiples fuentes externas en una base de datos relacional y buscable. Construido con React 19, TanStack Router, tRPC, Drizzle ORM y PostgreSQL, desplegado en un servidor Bun.

**⚠️ Aviso Importante**: Red Cliff Record se encuentra en un proceso de desarrollo avanzado y está optimizado para una sola persona (el autor del repositorio) y su propio conjunto idiosincrásico de fuentes de datos, aplicaciones y herramientas. Probablemente sea mucho menos efectivo para cualquiera que no utilice ese conjunto exacto de herramientas. Este es un software experimental y podría tener cambios incompatibles en cualquier momento; bifurca bajo tu propio riesgo.

## Resumen de la Arquitectura

- **Frontend**: React 19 + TanStack (Start, Router, Query) + Tailwind CSS v4
- **Sincronización**: [Rocicorp Zero](https://zero.rocicorp.dev) replica el grafo de entidades (registros, enlaces, enfrentamientos, medios) al cliente; las lecturas son consultas locales ZQL y las escrituras son mutadores personalizados optimistas
- **Backend**: tRPC + Drizzle ORM + PostgreSQL (búsqueda, selección de listas/oponentes y mutaciones pesadas como crear/eliminar/fusionar; también toda la superficie de la CLI)
- **Despliegue/Hosting**: Servidor Bun + PostgreSQL local en una red Tailscale
- **Búsqueda**: Búsqueda de texto completo de PostgreSQL + embeddings de OpenAI

## Requisitos Previos

Antes de comenzar, asegúrate de tener lo siguiente instalado:

- Entorno de ejecución y gestor de paquetes **Bun** (`curl -fsSL https://bun.sh/install | bash`)
- **Node.js v24+** (verifica con `node --version`)
- **PostgreSQL** (se recomienda v14+) con las siguientes extensiones:
  - `vector` - para embeddings vectoriales (instala con `CREATE EXTENSION vector;`)
  - `pg_trgm` - para búsqueda de texto por trigramas (instala con `CREATE EXTENSION pg_trgm;`)
  - Nota: Las extensiones se crean automáticamente mediante las migraciones si tu usuario tiene permisos
- **Git** para control de versiones
- **Cuenta de Cloudflare** - para almacenamiento R2

### Requisitos Opcionales

- **Airtable** - para la integración con Airtable
- **Arc Browser** - para la integración con Arc Browser
- **Dia Browser** - para la integración con Dia Browser
- **Feedbin** - para la integración con feeds RSS
- **GitHub** - para la integración con GitHub
- **Raindrop.io** - para la integración con Raindrop.io
- **Readwise** - para la integración con Readwise
- **Twitter/X** - para la integración con marcadores de Twitter/X
- **Adobe Lightroom** - para la integración con Adobe Lightroom

## Instrucciones de Configuración

### 1. Clonar el Repositorio

```bash
git clone https://github.com/yourusername/red-cliff-record.git
cd red-cliff-record
```

### 2. Instalar Dependencias

```bash
bun install
```

### 2.5 Instalar CLI (Opcional)

```bash
bun link
```

### 3. Configuración de la Base de Datos

**Nota sobre proveedores de bases de datos**: La aplicación se conecta a una base de datos PostgreSQL local. Si utilizas un proveedor diferente, actualiza `src/server/db/connections/postgres.ts` en consecuencia.

#### Crear Base de Datos PostgreSQL

```bash
# Conectarse a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE redcliffrecord;

# Salir de psql
\q
```

#### Configurar la Conexión a la Base de Datos

1. Copia el archivo de entorno de ejemplo:

```bash
cp .env.example .env
```

2. Actualiza `DATABASE_URL` en `.env`:

```
DATABASE_URL="postgresql://username:password@localhost:5432/redcliffrecord"
```

#### Ejecutar Migraciones

El sistema de migraciones utiliza Drizzle ORM e incluye todas las extensiones de PostgreSQL necesarias (`vector`, `pg_trgm`) en la migración inicial. Ejecuta las migraciones con:

```bash
bun run db:migrate
```

**Nota**: La migración inicial (`0000_rapid_triathlon.sql`) crea el esquema `extensions` e instala las extensiones requeridas. Asegúrate de que tu usuario de PostgreSQL tenga permisos para crear extensiones, o instálalas manualmente antes de ejecutar las migraciones:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### Poblar con Datos Iniciales

Después de ejecutar las migraciones, pobla la base de datos con el vocabulario inicial de predicados y los registros principales:

```bash
./src/server/db/db-manager.sh seed local
```

Esto carga:

- **Predicados**: Tipos de relación canónicos (p. ej., `created_by`, `contains`, `references`, `related_to`)
- **Registros**: Entidades centrales (p. ej., registro de usuario, registro de proyecto)

El script de semilla es idempotente y seguro para ejecutar múltiples veces; utiliza lógica de upsert para evitar duplicados.

Para inspeccionar tu base de datos:

```bash
bun run db:studio
```

### 4. Configurar Servicios Externos

Edita tu archivo `.env` y agrega las claves API para los servicios que deseas utilizar:

#### Servicios Requeridos

- **OpenAI** - Para generar embeddings
  ```
  OPENAI_API_KEY=sk-...
  ```

#### Integraciones Opcionales

Cada integración es opcional. Configura solo las que necesites:

- **GitHub** - Para sincronizar repositorios y estrellas

  ```
  GITHUB_TOKEN=ghp_...
  ```

  [Crea un token](https://github.com/settings/tokens) con los ámbitos `repo` y `user`.

- **Airtable** - Para sincronizar bases de Airtable

  ```
  AIRTABLE_BASE_ID=app...
  AIRTABLE_ACCESS_TOKEN=pat...
  ```

  [Obtén tu clave API](https://airtable.com/create/tokens)

- **Raindrop.io** - Para sincronizar marcadores

  ```
  RAINDROP_TEST_TOKEN=...
  ```

  [Crea una aplicación](https://app.raindrop.io/settings/integrations) y obtén un token de prueba.

- **Readwise** - Para sincronizar resaltados

  ```
  READWISE_TOKEN=...
  ```

  [Obtén tu token](https://readwise.io/access_token)

- **Feedbin** - Para sincronizar feeds RSS y entradas

  ```
  FEEDBIN_USERNAME=your@email.com
  FEEDBIN_PASSWORD=your-password
  ```

  Regístrate en [feedbin.com](https://feedbin.com)

- **Adobe Lightroom** - Para sincronizar fotos desde un álbum de Lightroom

  Nota: Actualmente está codificado específicamente para el álbum del autor. Consulta [INTEGRATIONS.md](./INTEGRATIONS.md#adobe-lightroom-integration) para obtener detalles de configuración.

### Configurar Almacenamiento Cloudflare R2

Para el almacenamiento de medios, necesitarás un bucket de Cloudflare R2:

1. [Crea una cuenta de Cloudflare](https://dash.cloudflare.com/sign-up)
2. [Crea un bucket R2](https://dash.cloudflare.com/?to=/:account/r2/buckets)
3. [Crea tokens API](https://dash.cloudflare.com/profile/api-tokens) con permisos de lectura/escritura para R2
4. Actualiza tu `.env`:
   ```
   CLOUDFLARE_ACCOUNT_ID=...
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_REGION=auto
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_BUCKET=your-bucket-name
   ASSETS_DOMAIN=https://your-assets-domain.com
   ```

### Motor de Sincronización Zero

La aplicación sincroniza su grafo de entidades a través de [zero-cache](https://zero.rocicorp.dev), que sigue la replicación lógica de Postgres. Configuración única de la base de datos (por base de datos):

```bash
# Requiere reiniciar Postgres después de cambiar wal_level
psql $DATABASE_URL -c "ALTER SYSTEM SET wal_level = 'logical';"
bun run zero:publication
```

Configura las variables `ZERO_*` y `PUBLIC_ZERO_CACHE_URL` en `.env` (consulta `.env.example`). `bun dev` inicia zero-cache junto con Vite, escribiendo sus registros en `.zero-cache/zero.log` (usa `tail -f` para observarlos). Para ejecutarlo en primer plano de forma independiente, usa `bun run dev:zero`.

#### Mantener el esquema sincronizado

El esquema del cliente Zero se genera a partir del esquema de Drizzle mediante `drizzle-zero.config.ts`; regenera con `bun run zero:generate` después de cambios en el esquema de las tablas sincronizadas.

`zero:publication` dirige la publicación `zero_data` exactamente a las columnas que declara el esquema. Es necesario porque `records` contiene tipos que Zero no puede replicar: `text_embedding` (vector) y `text_search` (tsvector), por lo que la publicación nombra explícitamente las columnas en lugar de publicar tablas completas, y **una lista de columnas de Postgres fija el conjunto publicado**: una columna agregada posteriormente no se replica hasta que se restablezca la lista, y hasta entonces zero-cache rechaza a cada cliente con `SchemaVersionNotSupported`. Derivar la lista del esquema generado evita que ambos se desvíen. El comando es declarativo e idempotente: crea la publicación si falta, y la pipeline de despliegue lo ejecuta después de cada migración.

Por lo tanto, una migración en una tabla sincronizada solo necesita:

```bash
bun run zero:generate     # si se agregaron, eliminaron o renombraron columnas
bun run zero:publication  # después de aplicar la migración
```

No se requiere reinicio ni reconstrucción de la réplica: zero-cache instala disparadores de eventos DDL en la base de datos principal, detecta los cambios de esquema publicados a medida que se confirman y los aplica a su réplica (rellenando las columnas agregadas) mientras se ejecuta.

#### Recuperar una réplica divergente

Si el estado de zero-cache ya ha divergido (clientes atascados en `SchemaVersionNotSupported` después de confirmar que la publicación es correcta), reconstrúyela desde cero. Eliminar solo `.zero-cache/replica.db3` no es suficiente, ya que zero-cache conserva su instantánea de esquema y registro de cambios en la base de datos principal en los esquemas `zero_0*` y reconstruye la réplica a partir de ellos:

```bash
# Detén `bun dev` primero; eliminar la réplica mientras zero-cache está en ejecución
# la corrupta ("replica db must be in wal2 mode").
rm -f .zero-cache/replica.db3*
psql $DATABASE_URL_DEV <<'SQL'
DROP EVENT TRIGGER IF EXISTS zero_ddl_start_0;
DROP EVENT TRIGGER IF EXISTS zero_ddl_end_0;
DROP SCHEMA IF EXISTS "zero_0/cdc" CASCADE;
DROP SCHEMA IF EXISTS "zero_0/cvr" CASCADE;
DROP SCHEMA IF EXISTS "zero_0" CASCADE;
DROP PUBLICATION IF EXISTS "_zero_metadata_0";
SELECT pg_drop_replication_slot(slot_name)
  FROM pg_replication_slots WHERE slot_name LIKE 'zero_%' AND NOT active;
SQL
bun dev  # zero-cache recrea sus metadatos y ejecuta una sincronización inicial nueva
```

Deja el esquema `zero` (permisos desplegados) y la publicación `zero_data` en su lugar; zero-cache no vuelve a crear esos elementos.

### Iniciar el Servidor de Desarrollo

```bash
bun run dev
```

### CLI (rcr)

`rcr` es un envoltorio local de CLI alrededor de los mismos procedimientos tRPC utilizados por la aplicación. Por defecto prioriza JSON y soporta una salida en tabla para inspección rápida.

Instala la CLI globalmente una vez desde el repositorio:

```bash
bun link
```

```bash
# Ayuda general
rcr --help

# Registros
rcr records get 123
rcr records get 123 --links              # Incluir todos los enlaces entrantes/salientes
rcr records get 123 456 789              # Múltiples IDs en paralelo
rcr records list --type=entity --limit=10
rcr records list --source=github --limit=10
rcr records create '{"title":"Example","type":"concept"}'

# Búsqueda
rcr search "machine learning"
rcr search semantic "machine learning" --limit=5
rcr search similar 456 --limit=5

# Enlaces
rcr links list 123
rcr links list 123 456                   # Múltiples registros
rcr links create '{"sourceId":1,"targetId":2,"predicateId":3}'

# Integraciones de sincronización
rcr sync github
rcr sync airtable
rcr sync raindrop
rcr sync readwise
rcr sync feedbin
rcr sync adobe
rcr sync browsing                       # Historial del navegador Arc + Dia (macOS)
rcr sync twitter
rcr sync agents                         # Historiales de Claude, Codex, Cursor
rcr sync avatars                        # Transferir avatares a R2
rcr sync embeddings                     # Generar embeddings para registros
rcr sync                                # Ejecutar todas las sincronizaciones diarias
```

Notas:

- Muestra JSON compacto por defecto; canaliza a `jq` para formatear.
- Se rechazan las banderas desconocidas (análisis estricto).
- La mayoría de los comandos basados en ID aceptan múltiples IDs para ejecución en paralelo.
- Usa `--format=table` para una salida legible por humanos.
- Usa `--debug` para obtener datos sin escribir en la base de datos (salida en `.temp/`).
- Usa `--` para detener el análisis de opciones cuando sea necesario.

## Compilación y Despliegue en Producción

**⚠️ Advertencia de Seguridad**: Esta aplicación actualmente **no tiene autenticación ni autorización**. Si se despliega públicamente, cualquier persona con la URL tendrá acceso completo de lectura/escritura a todos los datos a través de la interfaz de usuario. Solo despliega a producción si comprendes y aceptas este riesgo de seguridad, o implementa la autenticación primero.

### Compilar para Producción

```bash
bun run build
```

### Desplegar

1. Sube la carpeta `dist` a tu servidor e inicia el servidor Bun.
2. Asegúrate de que todas las variables de entorno de `.env` estén configuradas en tu host.

## Comandos de Desarrollo

```bash
bun run dev          # Iniciar servidor de desarrollo
bun run build        # Compilar para producción
bun check            # Lint (oxlint) + verificación de tipos (tsc) + formato (oxfmt) — rápido, ejecútalo frecuentemente
bun run lint         # Solo lint + verificación de tipos
bun run format       # Solo formato
bun run db:studio    # Abrir Drizzle Studio
bun run db:migrate   # Ejecutar migraciones
```

### Gestión de Base de Datos

Todas las operaciones de copia de seguridad/restauración pasan por `db-manager.sh` (o el envoltorio CLI `rcr db`):

```bash
rcr db backup <prod|dev>              # Copia de seguridad (crea prod-{timestamp}.dump o dev-{timestamp}.dump)
rcr db restore <prod|dev>             # Restaurar la copia de seguridad más reciente
rcr db restore dev --file path.dump   # Restaurar un archivo de copia de seguridad específico
rcr db seed dev                       # Poblar predicados + registros principales
rcr db reset dev                      # Eliminar y recrear la BD con extensiones
rcr db clone-prod-to-dev              # Clonar producción → desarrollo
```

Banderas: `--dry-run` (`-n`) imprime los comandos sin ejecutarlos. `-D` opera solo en datos (sin esquema). `-c` realiza una restauración limpia (eliminar y recrear primero). `--file` (`-f`) restaura desde un archivo específico en lugar de autodetectar. Las restauraciones terminan las conexiones existentes antes de ejecutar `pg_restore`.

Los archivos de copia de seguridad se nombran según la etiqueta del entorno (`prod-`, `dev-`), no por el nombre de la base de datos. La restauración autodetecta el archivo `.dump` más reciente en el directorio de copias de seguridad.

**Flujo de trabajo de reinicio** (comprimir migraciones mientras se preservan los datos):

1. `rcr db backup dev --data-only`
2. `rcr db reset dev`
3. `rm -rf migrations/main/*` (opcional)
4. `bun run db:generate` (si se realizó el paso 3)
5. `NODE_ENV=development bunx drizzle-kit migrate`
6. `rcr db seed dev`
7. `rcr db restore dev --data-only`

## Solución de Problemas

### Problemas de Conexión a la Base de Datos

- Asegúrate de que PostgreSQL esté ejecutándose: `pg_ctl status` o `brew services list` (macOS)
- Verifica el formato y las credenciales de `DATABASE_URL`
- Comprueba que la base de datos exista: `psql -U postgres -l`

### Errores de Compilación

- Limpia la caché: `rm -rf node_modules bun.lock dist && bun install`
- Verifica la versión de Node: Debe ser v24+ como se especifica en `.node-version`
- Ejecuta lint y verificación de tipos: `bun run lint`

### Fallos de Sincronización de Integraciones

- Verifica que las claves API sean correctas y tengan los permisos adecuados
- Revisa los límites de tasa para los servicios externos
- Ejecuta con `--debug` para probar la conectividad de la API sin escribir en la base de datos:
  ```bash
  rcr sync github --debug  # Muestra datos crudos de la API en .temp/
  ```

### Integración de Historial del Navegador (macOS)

#### Arc Browser

- Asegúrate de que el navegador Arc esté instalado y haya sido utilizado
- La integración lee desde: `~/Library/Application Support/Arc/User Data/Default/History`
- Puede requerir permisos de seguridad en Preferencias del Sistema

#### Dia Browser

- Asegúrate de que el navegador Dia esté instalado y haya sido utilizado
- La integración lee desde: `~/Library/Application Support/Dia/`
- Puede requerir permisos de seguridad en Preferencias del Sistema

#### Detalles de Sincronización del Navegador

- La sincronización ejecuta Arc y Dia secuencialmente bajo una sola ejecución de integración
- Cada navegador mantiene su propia marca de tiempo de sincronización por nombre de host
- La sincronización del navegador funciona para cualquier navegador basado en Chromium con configuración de ruta

## Licencia

MIT

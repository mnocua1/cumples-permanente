# Cumpleaños Permanente: cómo publicarlo gratis en Cloudflare Pages

La página (`public/`) y su API (`functions/api/`) se guardan en una base de datos **D1** de Cloudflare.
Todo cabe en el plan gratis y no tienes que poner tarjeta.

## 1. Sube los archivos a GitHub
1. En https://github.com crea un repositorio nuevo (por ejemplo `cumples-permanente`).
   Si ya tenías uno de la versión de Netlify, crea uno nuevo para no mezclar.
2. Toca **"uploading an existing file"** y arrastra **todo lo que hay dentro de esta carpeta**
   (`public`, `functions`, `LEEME.md`). Toca **Commit changes**.

## 2. Crea la cuenta y la base de datos en Cloudflare
1. Crea una cuenta gratis en https://dash.cloudflare.com/sign-up.
2. En el menú de la izquierda ve a **Storage & databases → D1 SQL database → Create database**.
   Ponle de nombre `cumples` y toca **Create**. No tienes que crear tablas, la página las crea sola.

## 3. Crea el proyecto en Pages
1. Ve a **Workers & Pages → Create**. Elige la pestaña **Pages** (no Workers) → **Import an existing Git repository**.
2. Conecta tu GitHub y elige el repositorio.
3. En la configuración:
   - Framework preset: **None**
   - Build command: **déjalo vacío**
   - Build output directory: **public**
4. Toca **Save and Deploy**.

## 4. Conecta la base de datos y las claves
Entra al proyecto → **Settings**:
1. **Bindings → Add → D1 database**. Variable name: **DB** (en mayúsculas). Database: **cumples**. Guarda.
2. **Variables and Secrets → Add** (opcional pero recomendado):
   - `TEAM_CODE`: la clave que el equipo escribe una sola vez para entrar (ej. `permanente26`).
   - `ADMIN_CODE`: tu clave secreta para borrar cualquier mensaje o persona.
3. Ve a **Deployments**, abre el último y toca **Retry deployment** para que se apliquen los cambios.

Tu página queda en `https://nombre-del-proyecto.pages.dev`. Ese es el enlace para el equipo.

## Si algo falla
- Si la página dice "Falta enlazar la base de datos D1 con el nombre DB": revisa el paso 4.1 y vuelve a desplegar.
- Para el modo administradora, toca "Soy administradora" al final de la página y escribe tu `ADMIN_CODE`.

## Límites del plan gratis (de sobra para un equipo)
100.000 visitas a la API por día, 5 GB de base de datos. Cada foto se reduce automáticamente antes de subirse.

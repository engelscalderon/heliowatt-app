# Guía de puesta en marcha — HelioWatt Cotizaciones y Facturas

Vas a hacer 3 cosas, una sola vez: **(1)** publicar la app en internet gratis, **(2)** registrar la app en Microsoft para que pueda usar tu OneDrive, **(3)** conectar ambas cosas. Toma unos 15-20 minutos.

---

## Paso 1 — Publicar la app en GitHub Pages (gratis)

1. Crea una cuenta en https://github.com si no tienes una.
2. Click en **"New repository"**. Nómbralo `heliowatt-app`. Déjalo público. Crear.
3. Dentro del repo, click en **"uploading an existing file"** (o arrastra la carpeta) y sube **todo el contenido** de la carpeta `heliowatt-app` que te entregué (el `index.html` debe quedar en la raíz del repo, no dentro de una subcarpeta).
4. Ve a **Settings → Pages**.
5. En "Source" elige **"Deploy from a branch"**, branch `main`, carpeta `/ (root)`. Guardar.
6. Espera 1-2 minutos y GitHub te dará una URL parecida a:
   `https://tuusuario.github.io/heliowatt-app/`
   **Cópiala, la necesitas en el paso 2.**

---

## Paso 2 — Registrar la app en Microsoft (para acceder a OneDrive)

1. Entra a https://portal.azure.com con tu cuenta de Microsoft (la misma que usas para OneDrive) y busca **"Registros de aplicaciones" / "App registrations"**.
2. Click **"New registration"**.
   - Nombre: `HelioWatt Facturacion`
   - Tipos de cuenta admitidos: elige **"Cuentas personales de Microsoft solamente"** (o la opción que incluya cuentas personales, ya que tu OneDrive es personal).
   - **Redirect URI**: selecciona tipo **"Single-page application (SPA)"** y pega la URL de GitHub Pages del paso 1, por ejemplo `https://tuusuario.github.io/heliowatt-app/`
   - Click **Register**.
3. En la pantalla de la app ya creada, copia el **"Application (client) ID"** — es un código como `a1b2c3d4-...`. Lo necesitas en el paso 3.
4. Ve a **"API permissions" → "Add a permission" → "Microsoft Graph" → "Delegated permissions"**, y agrega:
   - `Files.ReadWrite`
   - `User.Read`
   - `offline_access`
   Click **"Grant admin consent"** si aparece la opción (en cuentas personales puede no ser necesario).

No necesitas crear ningún "Client secret" — la app es 100% del lado del navegador (SPA), no lo uses.

---

## Paso 3 — Conectar la app con tus datos

1. En GitHub, abre el archivo `js/config.js` (botón del lápiz para editar).
2. Reemplaza:
   ```js
   clientId: "PEGA-AQUI-TU-CLIENT-ID",
   ```
   por el Client ID que copiaste en el paso 2.
3. Verifica que la URL publicada coincide exactamente con la que registraste como Redirect URI (con o sin `/` final — deben ser idénticas).
4. Guarda el cambio (commit). Espera 1 minuto a que GitHub Pages actualice.
5. Abre tu URL (`https://tuusuario.github.io/heliowatt-app/`) desde el celular, tablet o computadora.
6. Click **"Conectar OneDrive"**, inicia sesión con tu cuenta Microsoft y acepta los permisos.
7. La app creará automáticamente la carpeta `HelioWatt Facturacion` (con subcarpetas `Cotizaciones` y `Facturas`) en tu OneDrive, y un archivo `db.json` que funciona como base de datos de numeración, historial y comprobantes NCF.

**Listo.** Desde ahora, cada cotización o factura que generes:
- Se numera automáticamente y en secuencia (001-07/2026, 002-07/2026, …).
- Se guarda como PDF en tu OneDrive, dentro de `Cotizaciones` o `Facturas`.
- Al facturar, toma el próximo comprobante fiscal (NCF) disponible de la pestaña **"Comprobantes"** y lo marca como usado.
- Queda visible en **"Historial"** desde cualquier dispositivo donde inicies sesión.

---

## Pendiente de tu parte

- **Logo real**: no llegó adjunto en tu mensaje. Si me lo envías (PNG con fondo transparente, ideal), lo agrego al encabezado del PDF y de la app.
- **Excel de NCF**: usé como base los 10 comprobantes de tu PDF de control (`B0200000001` a `B0200000010`, con el primero ya marcado como usado). Si tienes un rango distinto o ya usaste más, dime cuáles o edítalos desde la pestaña **"Comprobantes"** en la app (botón "Agregar nuevo rango").
- Cuando se agote el talonario de NCF, la DGII te dará un rango nuevo — lo agregas ahí mismo, sin tocar código.

## Notas y límites

- La app funciona en cualquier navegador moderno (celular, tablet, PC) sin instalar nada — es una página web.
- Los datos (numeración, historial, NCF) viven en `db.json` dentro de tu propio OneDrive: si dos personas generan un documento *exactamente* al mismo segundo podría haber un choque; para el volumen de una pyme esto no es un problema en la práctica.
- Si algún día quieres restringir quién puede entrar (por ejemplo varios empleados con su propio login), se puede ampliar — dímelo y lo ajustamos.

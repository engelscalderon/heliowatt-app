// ============================================================
// CONFIGURACIÓN — edita estos valores según SETUP.md
// ============================================================
const APP_CONFIG = {
  // Client ID que te da Azure al registrar la app (ver SETUP.md paso 2)
  clientId: "PEGA-AQUI-TU-CLIENT-ID",

  // Debe coincidir EXACTO con la URL donde publiques la app (ver SETUP.md paso 3)
  // Ejemplo: "https://tuusuario.github.io/heliowatt-app/"
  redirectUri: window.location.origin + window.location.pathname,

  // Carpeta raíz dentro de "Mis archivos" de OneDrive donde se guardará todo
  rootFolder: "HelioWatt Facturacion",

  // Datos fijos de la empresa (se usan en el PDF)
  company: {
    nombre: "HELIOWATT, S.R.L.",
    tagline: "Engineering Solutions.",
    direccion: "Duverge 02, Trinitarios 2do",
    ciudad: "Santo Domingo, Este. Republica Dominicana 11801",
    rnc: "133-74986-6",
    telefonos: "809-245-6102 / 809-697-2815 / 829-641-5278",
    email: "engelscalderon@gmail.com",
    pago: "Cheques a nombre de Engels Calderón. Transferencias a Cuentas de ahorro: BHD -14690530011. BPD -826244774, BR-0102103646",
    itebis: 0.18
  }
};

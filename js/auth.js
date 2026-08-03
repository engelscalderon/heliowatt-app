// ============================================================
// AUTENTICACIÓN — Microsoft Login (MSAL) para acceder a OneDrive
// ============================================================
const GRAPH_SCOPES = ["Files.ReadWrite", "User.Read", "offline_access"];

let msalInstance = null;
let activeAccount = null;

function buildMsalInstance() {
  if (typeof APP_CONFIG === "undefined") {
    throw new Error(
      "No se cargó js/config.js. Verifica en tu repositorio de GitHub que el archivo existe exactamente en la ruta 'js/config.js' (minúsculas) y que index.html está en la RAÍZ del repositorio, no dentro de una subcarpeta."
    );
  }
  if (typeof msal === "undefined") {
    throw new Error("No se pudo cargar la librería MSAL desde ninguno de los dos CDN configurados. Verifica tu conexión a internet, o si usas una red con bloqueadores/firewall restrictivo (VPN, red corporativa, DNS filtrado), prueba con datos móviles u otra red.");
  }
  if (!APP_CONFIG.clientId || APP_CONFIG.clientId.includes("PEGA-AQUI")) {
    throw new Error("Falta configurar el Client ID en js/config.js (ver SETUP.md, Paso 3).");
  }
  const msalConfig = {
    auth: {
      clientId: APP_CONFIG.clientId,
      authority: "https://login.microsoftonline.com/consumers",
      redirectUri: APP_CONFIG.redirectUri
    },
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: false
    }
  };
  return new msal.PublicClientApplication(msalConfig);
}

async function authInit() {
  msalInstance = buildMsalInstance();
  const resp = await msalInstance.handleRedirectPromise();
  if (resp && resp.account) {
    activeAccount = resp.account;
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) activeAccount = accounts[0];
  }
  return activeAccount;
}

function authLogin() {
  msalInstance.loginRedirect({ scopes: GRAPH_SCOPES }).catch(e => {
    console.error(e);
    alert("No se pudo iniciar sesión: " + e.message);
  });
}

function authLogout() {
  msalInstance.logoutRedirect().catch(e => console.error(e));
}

async function getGraphToken() {
  if (!activeAccount) throw new Error("No hay sesión activa");
  const req = { scopes: GRAPH_SCOPES, account: activeAccount };
  try {
    const result = await msalInstance.acquireTokenSilent(req);
    return result.accessToken;
  } catch (e) {
    const result = await msalInstance.acquireTokenRedirect(req);
    return result.accessToken; // won't actually return, page redirects
  }
}

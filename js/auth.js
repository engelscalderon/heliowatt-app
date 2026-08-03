// ============================================================
// AUTENTICACIÓN — Microsoft Login (MSAL) para acceder a OneDrive
// ============================================================
const msalConfig = {
  auth: {
    clientId: APP_CONFIG.clientId,
    authority: "https://login.microsoftonline.com/consumers", // cuentas personales de Microsoft (Outlook/Hotmail/OneDrive personal)
    redirectUri: APP_CONFIG.redirectUri
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

const GRAPH_SCOPES = ["Files.ReadWrite", "User.Read", "offline_access"];

const msalInstance = new msal.PublicClientApplication(msalConfig);
let activeAccount = null;

async function authInit() {
  await msalInstance.initialize();
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
  msalInstance.loginRedirect({ scopes: GRAPH_SCOPES });
}

function authLogout() {
  msalInstance.logoutRedirect();
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

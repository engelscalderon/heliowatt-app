// ============================================================
// ROLES — sesión General / Administrativo
// IMPORTANTE: esto es una protección del lado del cliente (navegador),
// pensada para que el personal normal no entre por accidente al módulo
// administrativo. NO es seguridad real: el repositorio es público y
// cualquier persona con conocimientos técnicos podría revisar el código.
// La contraseña se guarda como hash (SHA-256), no en texto plano.
// ============================================================
const ADMIN_PASSWORD_HASH = "0a1d61705f1bff7b1ff89be93383e905a59a63766741ee8eef89599122a7047e";

let currentRole = null; // 'general' | 'admin'

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function roleGet() {
  return currentRole || sessionStorage.getItem("helio_role") || null;
}

function roleSet(role) {
  currentRole = role;
  sessionStorage.setItem("helio_role", role);
}

function roleClear() {
  currentRole = null;
  sessionStorage.removeItem("helio_role");
}

function isAdmin() {
  return roleGet() === "admin";
}

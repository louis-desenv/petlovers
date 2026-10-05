const fs = require("fs");
const path = require("path");

/**
 * Utilitário para limpar valores de variáveis de ambiente
 * Remove aspas circundantes e quebras de linha indesejadas
 * @param {*} val
 * @returns {string}
 */
function cleanApiVal(val) {
  if (!val) return "";
  return String(val)
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\r?\n/g, "")
    .trim();
}

/**
 * Lê uma variável diretamente de arquivos .env locais se existirem
 * @param {string} varName
 * @returns {string}
 */
function getEnvFileVar(varName) {
  try {
    const candidatePaths = [
      path.join(process.cwd(), ".env"),
      path.join(process.cwd(), ".env.local"),
      path.join(__dirname, "..", "..", ".env"),
      path.join(__dirname, "..", "..", ".env.local")
    ];

    for (const envPath of candidatePaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
          const [k, ...v] = trimmed.split("=");
          if (k.trim() === varName) {
            const val = cleanApiVal(v.join("="));
            if (val) return val;
          }
        }
      }
    }
  } catch (e) {
    // Silencioso se não houver arquivo .env
  }
  return "";
}

/**
 * Obtém dinamicamente a chave da API do Google Gemini
 * Suporta múltiplos aliases de variáveis em ambientes como Railway, Vercel e Docker
 * @returns {string}
 */
function getGeminiApiKey() {
  const candidateKeys = [
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENAI_API_KEY",
    "GEMINI_KEY",
    "GEMINI_APIKEY",
    "GOOGLE_GEMINI_API_KEY",
    "VITE_GEMINI_API_KEY",
    "NEXT_PUBLIC_GEMINI_API_KEY",
    "RAILWAY_GEMINI_API_KEY",
    "API_KEY"
  ];

  for (const k of candidateKeys) {
    if (process.env[k]) {
      const cleaned = cleanApiVal(process.env[k]);
      if (cleaned) return cleaned;
    }
  }

  for (const [key, val] of Object.entries(process.env)) {
    const lower = key.toLowerCase();
    if (lower.includes("gemini") || (lower.includes("google") && lower.includes("key"))) {
      const cleaned = cleanApiVal(val);
      if (cleaned && cleaned.length > 5) return cleaned;
    }
  }

  for (const k of candidateKeys) {
    const fileVal = getEnvFileVar(k);
    if (fileVal) return fileVal;
  }

  return "";
}

/**
 * Obtém a chave da Atlas Cloud para geração de vídeo 3D
 * @returns {string}
 */
function getAtlasApiKey() {
  const candidateKeys = [
    "ATLASCLOUD_API_KEY",
    "ATLAS_CLOUD_API_KEY",
    "ATLAS_API_KEY",
    "VITE_ATLASCLOUD_API_KEY"
  ];

  for (const k of candidateKeys) {
    if (process.env[k]) {
      const cleaned = cleanApiVal(process.env[k]);
      if (cleaned) return cleaned;
    }
  }

  for (const k of candidateKeys) {
    const fileVal = getEnvFileVar(k);
    if (fileVal) return fileVal;
  }

  return "";
}

module.exports = {
  PORT: process.env.PORT || 3000,
  cleanApiVal,
  getEnvFileVar,
  getGeminiApiKey,
  getAtlasApiKey
};

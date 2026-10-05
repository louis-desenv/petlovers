/**
 * Dr. Miau Pet Agent - Servidor Express Principal
 * Arquitetura MVC modular, limpa e de fácil manutenção para equipes de frontend e backend.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");

const { PORT } = require("./server/config/env");
const routes = require("./server/routes");

const app = express();

// Middlewares essenciais de parsing de corpo com suporte a imagens em Base64
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Middleware Anti-Cache estrito para todas as rotas da API
// Previne que navegadores e proxies reaproveitem dados de conversas anteriores ou persistam estados expirados
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

// Middleware de CORS e cabeçalhos de segurança
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-User-Id, X-Session-Id, X-Conversation-Id");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Sincronização proativa de vídeos locais de src/ para public/videos/
function syncMediaAssets() {
  try {
    const srcDir = path.join(__dirname, "src");
    const destDir = path.join(__dirname, "public", "videos");

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(srcDir)) {
      const srcFiles = fs.readdirSync(srcDir);
      for (const file of srcFiles) {
        if (file.endsWith(".mp4")) {
          const srcPath = path.join(srcDir, file);
          const cleanName = file.replace(/\s+/g, "_");
          const destPath = path.join(destDir, cleanName);

          if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
            try {
              fs.copyFileSync(srcPath, destPath);
              if (file.includes(" ")) {
                fs.copyFileSync(srcPath, path.join(destDir, file));
              }
            } catch (err) {}
          }
        }
      }
    }
  } catch (err) {
    console.log("[Video Sync] Servindo vídeos estáticos existentes.");
  }
}
syncMediaAssets();

// Montagem das rotas da aplicação (Healthcheck + API REST)
app.use(routes);

// Servir arquivos de mídia e vídeos estáticos com fallback 404
app.use("/videos", express.static(path.join(__dirname, "public", "videos")));
app.use("/videos", express.static(path.join(__dirname, "dist", "videos")));
app.use("/videos", express.static(path.join(__dirname, "src")));
app.get("/videos/*", (req, res) => {
  res.status(404).type("text/plain").send("Vídeo não encontrado no servidor.");
});

// Servir assets estáticos da aplicação (HTML, CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, "public")));

// Fallback SPA para navegação do frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Inicialização do servidor HTTP
if (process.env.NODE_ENV !== "test" && require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Dr. Miau Pet Agent ativo e ouvindo na porta ${PORT}`);
  });
}

module.exports = app;

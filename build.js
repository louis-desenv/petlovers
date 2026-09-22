const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🚀 Executando script de build para Vercel...");

try {
  // Executa o build do Vite primeiro
  console.log("📦 Compilando aplicação frontend com Vite...");
  execSync("npx vite build", { stdio: "inherit" });

  // Sincroniza imagens e vídeos do src/ para public/
  const srcImg = path.join(__dirname, "src", "dr-miau.png");
  const destImg = path.join(__dirname, "public", "dr-miau.png");
  if (fs.existsSync(srcImg)) {
    fs.copyFileSync(srcImg, destImg);
    console.log("✅ Imagem dr-miau.png copiada para public/");
  }

  const srcDir = path.join(__dirname, "src");
  const destVideosDir = path.join(__dirname, "public", "videos");
  if (!fs.existsSync(destVideosDir)) {
    fs.mkdirSync(destVideosDir, { recursive: true });
  }

  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    files.forEach(file => {
      if (file.endsWith(".mp4")) {
        const srcFile = path.join(srcDir, file);
        let cleanName = file.replace(/\s+/g, "_");
        if (cleanName === "faliz1.mp4") cleanName = "feliz1.mp4";
        const destFile = path.join(destVideosDir, cleanName);
        fs.copyFileSync(srcFile, destFile);

        // Se a fita original com espaço também for solicitada
        if (file.includes(" ")) {
          fs.copyFileSync(srcFile, path.join(destVideosDir, file));
        }
      }
    });
    console.log("✅ Vídeos sincronizados para public/videos/");
  }

  // Copia os arquivos estáticos de mídia para dist/
  const distDir = path.join(__dirname, "dist");
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const distVideosDir = path.join(distDir, "videos");
  if (!fs.existsSync(distVideosDir)) {
    fs.mkdirSync(distVideosDir, { recursive: true });
  }
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    files.forEach(file => {
      if (file.endsWith(".mp4")) {
        const srcFile = path.join(srcDir, file);
        let cleanName = file.replace(/\s+/g, "_");
        if (cleanName === "faliz1.mp4") cleanName = "feliz1.mp4";
        fs.copyFileSync(srcFile, path.join(distVideosDir, cleanName));
      }
    });
  }

  console.log("🎉 Build concluído com sucesso! Pasta dist/ criada.");
} catch (err) {
  console.error("❌ Erro durante o build:", err);
  process.exit(1);
}

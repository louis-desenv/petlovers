// server.js — Servidor Express para o Pet Agent Dr. Miau
// Substitui a API do Simli pela integração direta com a API do Google Gemini
// Inteligência artificial para classificação de sentimentos e respostas em tempo real.

const express = require("express");
const path = require("path");
const fs = require("fs");
try { require("dotenv").config(); } catch (e) {}

// Função auxiliar para limpar chaves de API carregadas do .env ou process.env
function cleanApiVal(val) {
  if (!val) return "";
  return String(val)
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
}

// Leitura direta de arquivos .env (.env, .env.local, .env.production) caso process.env ainda não tenha as chaves
function getEnvFileVar(varName) {
  try {
    const envFiles = [".env", ".env.local", ".env.production"];
    const baseDirs = [__dirname, process.cwd()];
    
    for (const baseDir of baseDirs) {
      for (const envFile of envFiles) {
        const envPath = path.join(baseDir, envFile);
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, "utf8");
          const lines = content.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx !== -1) {
              const key = trimmed.slice(0, eqIdx).trim();
              if (key.toUpperCase() === varName.toUpperCase()) {
                const val = trimmed.slice(eqIdx + 1);
                const cleaned = cleanApiVal(val);
                if (cleaned) return cleaned;
              }
            }
          }
        }
      }
    }
  } catch (e) {}
  return "";
}
const { GoogleGenAI, Type, ThinkingLevel } = require("@google/genai");

// Mensagens iniciais padrão do sistema para filtragem de histórico
const INITIAL_MESSAGE = "Olá! Sou o Dr. Miau! 🐾 É um prazer imenso estar aqui com você! Fique à vontade para bater um papo, contar como foi seu dia ou me fazer qualquer pergunta!";
const ALT_INITIAL_MESSAGE = "Olá! Sou o Dr. Miau! 🐾 Que alegria falar com você! Fique à vontade para bater um papo!";
const OLD_INITIAL_MESSAGE = "Olá! Sou o Dr. Miau! 🐾 Me conta: que tipo de bichinho de estimação você tem? É um gatinho, um cãozinho ou outro amiguinho?";
const OLD_INITIAL_MESSAGE_2 = "Olá! Sou o Dr. Miau, seu agente de pets. Me conta sua ideia!";

// Certifica de que a imagem dr-miau.png e os vídeos mp4 estão disponíveis no diretório public
try {
  const srcImg = path.join(__dirname, "src", "dr-miau.png");
  const destImg = path.join(__dirname, "public", "dr-miau.png");
  if (fs.existsSync(srcImg)) {
    fs.copyFileSync(srcImg, destImg);
    console.log("✅ Imagem dr-miau.png copiada com sucesso para public/");
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
        // Normaliza o nome sem espaços ou acentos estranhos
        let cleanName = file.replace(/\s+/g, "_");
        if (cleanName === "faliz1.mp4") cleanName = "feliz1.mp4";
        const destFile = path.join(destVideosDir, cleanName);
        fs.copyFileSync(srcFile, destFile);
        console.log(`✅ Vídeo ${file} sincronizado para public/videos/${cleanName}`);
      }
    });
  }
} catch (imgErr) {
  console.error("Erro ao sincronizar arquivos de mídia para public/", imgErr);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CHAVE DE API DA MAGIC HOUR (CONFIGURAÇÃO)
// Troque a chave abaixo sempre que necessário
// ==========================================
const MAGIC_HOUR_API_KEY = "mhk_live_hqrI27aSFI21y0dTp8w0EDWqeFdnH7CnILLNymFreVw156uQ3z7GQmN2KtEkFSa47EA5X2lgUFwrZWWR";

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Enable CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// URLs dos vídeos pré-renderizados para sentimentos específicos no Magic Hour
const videoUrls = {
  bem_vindo: "https://videos.magichour.ai/cmqi77bif00ao340z3mlv4sfq/output.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=web-service%40magic-hour-385504.iam.gserviceaccount.com%2F20260617%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260617T153121Z&X-Goog-Expires=43200&X-Goog-SignedHeaders=host&X-Goog-Signature=533f8c5f5df4ad01ae263fa646a71ff36ea1fabf3b4a092b9ac7866284ac4c14f5eb7cd8b4c763b00c744243d435bfc728ecc10d9532daf10631e77a9d5b0c93d042d055f6bbc52ce0beaacd706d12f800e64b2833c52d559db48930eddf758425df57e42a76b8ac07532928ccab4d054e56d5664c82a60535c5684f6a387b6a019e79a1b52e68c3ca65c6b353ea2dc73a71e8acb8f351a449552882a8514b758a6ec7e485d0059143fa2edd75cd23d55af247c3fe1f48d9310634b554c08ea32931da3605451f302f73136f56638079bed4cb48a15d6a2757490e15e1fb2d8ee70198c5b6962e3bef561b282e5d6dea50a4b40355dfc7e0b949333626e53125",
  normal: "https://videos.magichour.ai/cmqi7cevi00aa1q0zkob3xvk8/output.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=web-service%40magic-hour-385504.iam.gserviceaccount.com%2F20260617%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260617T153121Z&X-Goog-Expires=43200&X-Goog-SignedHeaders=host&X-Goog-Signature=51a21e8cbd1c2e654d697e04c93e358622b10cac70656ce627de240d9e7615fa6a185c8adc679858028a1207304316daf03177a8d626707d3f6d2078e42595ad379b25b39a44cff7ea1d5bb7042fec9034918acd17dab7f299e7d6812b57ed8326a8d405af29113f734fe0419b336c16c5a3f049fad8f7169572e724ad8f23ff24efb752dbc82519de9536db8e9ef051cba03656504841513956f6f2362adaf2eda19c066e8604bdbbbf39f005e4a24df8e485cd03dc2ce02fc3c11230431f6dc26c1c0bd3d520fe39a59029f55678f857b001ee1b67124c43132386748f9bc741e975daac2c08d55d51ce91901e7ac86a80c8eafb03e3e9c7337fee2ffadf9c",
  feliz: "https://videos.magichour.ai/cmqi79lg204s72z0zqn8abte1/output.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=web-service%40magic-hour-385504.iam.gserviceaccount.com%2F20260617%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260617T153121Z&X-Goog-Expires=43200&X-Goog-SignedHeaders=host&X-Goog-Signature=2d36b207dda51daed476fd0b312a2f0c29bdacd29834f5907e8e066314fa8f6a98a25a95aa4eba53b6e5e7fd6737a0cffd6f18f3b9f86acc88c4a052c05f83ba50b80d2479172db6cf197e659bbd212bdf3e6f724beb08d8b283c3fb38ded79c6197a18cfdb0ec8d61c8bcfddb01a829f17a4b7c247813e9109baf06df60caded900062f11297d4f70ed30250f7a9b093703524bd29cbf27a610dd556f709d3a5cd307354b5a17b4ff52de067f63db7742409c56ea826956952a58b00bb2eefb843bb47e10587c3b5b22a09e75c787bb019acf10e6c37471fb1f921212edca62c69527fc7d7483f82a60898e3f4952491ff489b97c9f0e98e2a7c8e888e96884",
  triste: "https://videos.magichour.ai/cmqi75kf70011y50ztgq9nm16/output.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=web-service%40magic-hour-385504.iam.gserviceaccount.com%2F20260617%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260617T153121Z&X-Goog-Expires=43200&X-Goog-SignedHeaders=host&X-Goog-Signature=37ab787e416f7c9415e751c50a9c9157486b87f5c1afe2344c71d6fac91ad71afafa499cdcc9589f37d7f8f6a8a7959390f163e19038c3ff85b488018f80cd7422b5b9ebe4c3cd74a706ed3170b5d17239078bd25ec5fe3e5b5e2af6a9b4f96f198334bd9f30b2468cfcc034f7f26ba39f78a47ba7cfb90167d6e3d677815f231aa65ac917d3456cd91aed7906b1aa547449c7e95030280762b74144832e82832dc318a25b7ac18fb81c5be67e235f28ca328749c99b96fcc36548d224d3c04dd45940a2a8c016c515297b0a4a7f8c37c8b9464f72083d55b249e406a68d7d267b0f1ced95d41d66c2e7074bb9c9cb1fd4cefd44f6eb3995f80d97d137c4d566",
  raiva: "https://videos.magichour.ai/cmqi7hsjn00cm340zpo151fwp/output.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=web-service%40magic-hour-385504.iam.gserviceaccount.com%2F20260617%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260617T153121Z&X-Goog-Expires=43200&X-Goog-SignedHeaders=host&X-Goog-Signature=9c5953409be597ea48e3a7310a5153bd45d4fda90598bfc3acfac77e941ccbd71ac1e998fe220c5cf8767bde4b09f6401bff05d8d22282f21098d4f971634eab39155d94e16002f6d96efc64946a11b3c1e49bc0bae04140a7e41ba8c8f11f945362a6a31b3cae5a204bf3085d49869a2a4e0f5b08cf8b35d1e40b61b77d690a67016d7e267738c3687150ed6a8861f25b71727cd420ce98e6a3c692e69b4bba9d8240e32ce65b32cc139acabb4e66b1aa8607533001a87de477691331340a707ddd55b496f7206fe9cadac73264d480175d24d1faa9f90826028013fcba964d01a1e25346f3d2043e2ede7c5f3e200d0b11101c7f6ec14c2b8c2165308edd75"
};

// Histórico do último prompt gerado para o Magic Hour (para inspeção e testes)
let lastMagicHourPromptInfo = {
  prompt: null,
  timestamp: null,
  jobId: null,
  status: null
};

// Copia vídeos do src/ para public/videos/ se necessário, sem baixar URLs expiradas que corrompem os arquivos mp4
async function downloadVideos() {
  try {
    const dir = path.join(__dirname, "public", "videos");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Copiar de forma proativa os vídeos locais do diretório src se existirem e não estiverem no destino
    if (fs.existsSync(path.join(__dirname, "src"))) {
      const srcFiles = fs.readdirSync(path.join(__dirname, "src"));
      for (const file of srcFiles) {
        if (file.endsWith(".mp4")) {
          const srcPath = path.join(__dirname, "src", file);
          const cleanName = file.replace(/\s+/g, "_");
          const destPath = path.join(dir, cleanName);
          if (fs.existsSync(srcPath)) {
            try {
              fs.copyFileSync(srcPath, destPath);
              if (file.includes(" ")) {
                fs.copyFileSync(srcPath, path.join(dir, file));
              }
            } catch (err) {}
          }
        }
      }
    }
  } catch (globalErr) {
    console.log("[Video Sync] Servindo vídeos estáticos da pasta public/videos.");
  }
}

// Inicia download de vídeos de suporte em background
downloadVideos().catch(err => console.error("Erro no downloader de vídeos de background:", err));

// Configuração do Google Gemini API com carregamento dinâmico via variável de ambiente (Railway, Vercel, Docker, .env)
function getCurrentKey() {
  // 1. Variáveis diretas prioritárias
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

  // 2. Busca dinâmica case-insensitive em todas as chaves do process.env (ótimo para Railway)
  for (const [key, val] of Object.entries(process.env)) {
    const lower = key.toLowerCase();
    if (lower.includes("gemini") || (lower.includes("google") && lower.includes("key"))) {
      const cleaned = cleanApiVal(val);
      if (cleaned && cleaned.length > 5) return cleaned;
    }
  }
  
  // 3. Busca em arquivos .env
  for (const k of candidateKeys) {
    const fileVal = getEnvFileVar(k);
    if (fileVal) return fileVal;
  }

  return "";
}

function getMagicHourKey() {
  const candidateKeys = [
    "MAGIC_HOUR_API_KEY",
    "MAGICHOUR_API_KEY",
    "MAGIC_HOUR_KEY",
    "MAGICHOUR_KEY"
  ];

  for (const k of candidateKeys) {
    if (process.env[k]) {
      const cleaned = cleanApiVal(process.env[k]);
      if (cleaned && !cleaned.includes("sua_chave_aqui")) return cleaned;
    }
  }

  if (MAGIC_HOUR_API_KEY && !MAGIC_HOUR_API_KEY.includes("sua_chave_aqui")) {
    return cleanApiVal(MAGIC_HOUR_API_KEY);
  }

  for (const k of candidateKeys) {
    const fileVal = getEnvFileVar(k);
    if (fileVal && !fileVal.includes("sua_chave_aqui")) return fileVal;
  }

  return "";
}

// Função de diagnóstico de status das APIs
async function checkApiStatuses() {
  const geminiKey = getCurrentKey();
  const magicHourKey = getMagicHourKey();

  const status = {
    gemini: {
      keyConfigured: !!geminiKey,
      connected: false,
      keyPreview: geminiKey ? geminiKey.slice(0, 6) + "..." : "NÃO CONFIGURADA",
      error: null,
      message: ""
    },
    magicHour: {
      keyConfigured: !!magicHourKey && !magicHourKey.includes("sua_chave_aqui"),
      connected: false,
      keyPreview: magicHourKey && !magicHourKey.includes("sua_chave_aqui") ? magicHourKey.slice(0, 6) + "..." : "NÃO CONFIGURADA",
      error: null,
      message: ""
    },
    timestamp: new Date().toISOString()
  };

  if (!geminiKey) {
    status.gemini.error = "GEMINI_API_KEY_MISSING";
    status.gemini.message = "A variável GEMINI_API_KEY não foi encontrada. No Railway: acesse seu serviço > aba Variables > adicione GEMINI_API_KEY com sua chave do Google AI Studio.";
  } else {
    const testModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let pingSuccess = false;
    let lastErrMessage = "";

    for (const testModel of testModels) {
      if (pingSuccess) break;
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const testRes = await ai.models.generateContent({
          model: testModel,
          contents: "ping"
        });
        if (testRes && testRes.text) {
          status.gemini.connected = true;
          status.gemini.message = `Conexão com a API do Gemini estabelecida e respondendo normalmente (${testModel})! ✨`;
          pingSuccess = true;
          break;
        }
      } catch (err) {
        lastErrMessage = err.message || String(err);
        try {
          const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${geminiKey}`;
          const restRes = await fetch(restUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
          });
          if (restRes.ok) {
            status.gemini.connected = true;
            status.gemini.message = `Conexão com a API do Gemini estabelecida via REST (${testModel})! ✨`;
            pingSuccess = true;
            break;
          }
        } catch (restErr) {
          lastErrMessage = restErr.message || String(restErr);
        }
      }
    }

    if (!pingSuccess) {
      status.gemini.connected = false;
      status.gemini.error = "GEMINI_PING_FAILED";
      status.gemini.message = `Chave detectada, mas os modelos não responderam: ${lastErrMessage.slice(0, 180)}`;
    }
  }

  if (!magicHourKey || magicHourKey.includes("sua_chave_aqui")) {
    status.magicHour.error = "MAGIC_HOUR_KEY_MISSING";
    status.magicHour.message = "A variável MAGIC_HOUR_API_KEY não foi configurada. Adicione MAGIC_HOUR_API_KEY nas variáveis do Railway para permitir geração de vídeos 3D.";
  } else {
    try {
      const mhRes = await fetch("https://api.magichour.ai/v1/account", {
        headers: { "Authorization": `Bearer ${magicHourKey}` }
      });
      if (mhRes.ok) {
        const mhData = await mhRes.json();
        status.magicHour.connected = true;
        status.magicHour.credits = typeof mhData.credits === "number" ? mhData.credits : null;
        status.magicHour.email = mhData.email || null;
        status.magicHour.message = `Conexão com a API Magic Hour estabelecida! Saldo disponível: ${mhData.credits ?? "OK"} créditos. 🎬`;
      } else if (mhRes.status === 401) {
        status.magicHour.connected = false;
        status.magicHour.error = "MAGIC_HOUR_401_UNAUTHORIZED";
        status.magicHour.message = "Chave MAGIC_HOUR_API_KEY inválida ou incorreta (HTTP 401). Verifique a chave no painel do Magic Hour.";
      } else if (mhRes.status === 402) {
        status.magicHour.connected = false;
        status.magicHour.error = "MAGIC_HOUR_402_NO_CREDITS";
        status.magicHour.message = "Chave Magic Hour válida, porém sem créditos suficientes para gerar novos vídeos (HTTP 402).";
      } else {
        status.magicHour.connected = true;
        status.magicHour.message = `Chave Magic Hour configurada no servidor (HTTP ${mhRes.status}). 🎬`;
      }
    } catch (mhErr) {
      status.magicHour.connected = false;
      status.magicHour.error = "MAGIC_HOUR_FETCH_FAILED";
      status.magicHour.message = `Erro ao conectar na API Magic Hour: ${mhErr.message}`;
    }
  }

  return status;
}

// Função auxiliar para garantir alternância estrita entre roles ("user" e "model") exigida pela API do Gemini
function buildAlternatingContents(cleanedHistory, currentMessage) {
  const rawTurns = [];

  if (Array.isArray(cleanedHistory)) {
    for (const h of cleanedHistory) {
      if (!h || !h.text || h.text === INITIAL_MESSAGE || h.text === ALT_INITIAL_MESSAGE || h.text === OLD_INITIAL_MESSAGE || h.text === OLD_INITIAL_MESSAGE_2) continue;
      const role = (h.role === "user" || h.role === "User") ? "user" : "model";
      rawTurns.push({ role, text: String(h.text).trim() });
    }
  }

  const msgTrimmed = (currentMessage || "").trim();
  if (msgTrimmed) {
    const lastTurn = rawTurns[rawTurns.length - 1];
    if (!lastTurn || lastTurn.role !== "user" || lastTurn.text !== msgTrimmed) {
      rawTurns.push({ role: "user", text: msgTrimmed });
    }
  }

  const sanitizedTurns = [];
  for (const turn of rawTurns) {
    if (!turn.text) continue;

    if (sanitizedTurns.length === 0) {
      if (turn.role === "user") {
        sanitizedTurns.push({ role: "user", text: turn.text });
      }
    } else {
      const prev = sanitizedTurns[sanitizedTurns.length - 1];
      if (prev.role === turn.role) {
        prev.text += "\n" + turn.text;
      } else {
        sanitizedTurns.push({ role: turn.role, text: turn.text });
      }
    }
  }

  if (sanitizedTurns.length === 0) {
    sanitizedTurns.push({ role: "user", text: msgTrimmed || "Olá" });
  }

  return sanitizedTurns.map(t => ({
    role: t.role,
    parts: [{ text: t.text }]
  }));
}

let cachedWorkingModel = "gemini-3.8-flash";

// Criamos uma função de inicialização e consulta resiliente do Gemini
async function callGemini(contents, systemInstruction, history = []) {
  let lastUserText = "";
  if (Array.isArray(contents) && contents.length > 0) {
    const lastItem = contents[contents.length - 1];
    if (typeof lastItem === "string") {
      lastUserText = lastItem;
    } else if (lastItem.parts && Array.isArray(lastItem.parts) && lastItem.parts[0]) {
      lastUserText = lastItem.parts[0].text || "";
    } else if (lastItem.text) {
      lastUserText = lastItem.text;
    }
  }

  const currentKey = getCurrentKey();
  if (!currentKey) {
    const errorDetails = "GEMINI_API_KEY_MISSING: A variável GEMINI_API_KEY não foi encontrada nas variáveis de ambiente do Railway. Adicione GEMINI_API_KEY no painel da Railway em Variables.";
    console.warn("⚠️ [Gemini Client] " + errorDetails);
    return generateSmartFallback(lastUserText, history, errorDetails);
  }

  const isToken = currentKey.startsWith("ya29.");
  console.log(`[Gemini Resilient Client] Chamando API. Chave presente (comprimento: ${currentKey.length}, isToken: ${isToken})`);

  const responseSchemaDef = {
    type: Type.OBJECT,
    properties: {
      response: {
        type: Type.STRING,
        description: "A resposta do Dr. Miau em português de 2 a 4 frases felinas amigáveis e acolhedoras."
      },
      sentiment: {
        type: Type.STRING,
        enum: ["alegre", "neutro", "preocupado", "protetor", "confuso"],
        description: "A emoção correspondente do avatar: alegre, neutro, preocupado, protetor, confuso"
      },
      phase: {
        type: Type.INTEGER,
        description: "A fase atual da entrevista (1, 2 ou 3)."
      },
      progress: {
        type: Type.INTEGER,
        description: "O progresso acumulado da entrevista de 0 a 100."
      },
      trigger_video_generation: {
        type: Type.BOOLEAN,
        description: "Defina como true apenas quando todas as 3 fases forem concluídas com sucesso."
      },
      video_prompt: {
        type: Type.STRING,
        description: "O prompt sintetizado detalhado em inglês para o Magic Hour, ou string vazia se trigger_video_generation for false."
      }
    },
    required: ["response", "sentiment", "phase", "progress", "trigger_video_generation", "video_prompt"]
  };

  const restResponseSchemaDef = {
    type: "OBJECT",
    properties: {
      response: { type: "STRING" },
      sentiment: { type: "STRING", enum: ["alegre", "neutro", "preocupado", "protetor", "confuso"] },
      phase: { type: "INTEGER" },
      progress: { type: "INTEGER" },
      trigger_video_generation: { type: "BOOLEAN" },
      video_prompt: { type: "STRING" }
    },
    required: ["response", "sentiment", "phase", "progress", "trigger_video_generation", "video_prompt"]
  };

  // Modelos suportados oficiais em ordem de velocidade e resiliência de cota
  const baseModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  const modelsToTry = Array.from(new Set([cachedWorkingModel, ...baseModels]));
  const lastErrors = [];

  for (const modelName of modelsToTry) {
    // --- TENTATIVA 1: SDK Oficial com Developer API e Thinking Level LOW ---
    try {
      const ai = new GoogleGenAI({ apiKey: currentKey });
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchemaDef,
          maxOutputTokens: 250,
          temperature: 0.7,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW
          }
        }
      });

      if (response && response.text) {
        cachedWorkingModel = modelName;
        console.log(`⚡ [Gemini Fast Client] Resposta rápida gerada com ${modelName}!`);
        return response.text;
      }
    } catch (sdkErr) {
      const errMsg = String(sdkErr.message || sdkErr);
      const isQuotaError = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota") || errMsg.includes("quota");

      let errType = "SDK_ERROR";
      if (isQuotaError) {
        errType = "COTA_429";
      } else if (errMsg.includes("API key not valid") || errMsg.includes("401") || errMsg.includes("UNAUTHENTICATED")) {
        errType = "CHAVE_GEMINI_INVALIDA_401";
      } else if (errMsg.includes("403") || errMsg.includes("PERMISSION_DENIED")) {
        errType = "PERMISSAO_NEGADA_403";
      } else if (errMsg.includes("fetch failed") || errMsg.includes("ENOTFOUND")) {
        errType = "ERRO_CONEXAO_REDE";
      }

      const sdkErrLog = `[${errType} - SDK ${modelName}: ${errMsg.slice(0, 100)}]`;
      console.log(`⚠️ [Gemini Client] ${sdkErrLog}`);
      lastErrors.push(sdkErrLog);

      if (isQuotaError) {
        continue;
      }

      // --- TENTATIVA 2: REST API Direta ---
      try {
        let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
        const headers = {
          "Content-Type": "application/json",
          "User-Agent": "aistudio-build"
        };
        
        if (isToken) {
          headers["Authorization"] = `Bearer ${currentKey}`;
        } else {
          apiUrl += `?key=${currentKey}`;
        }

        const payload = {
          contents: contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: restResponseSchemaDef,
            maxOutputTokens: 350,
            temperature: 0.7,
            thinkingConfig: {
              thinkingLevel: "LOW"
            }
          }
        };

        const res = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json = await res.json();
          const extracted = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (extracted) {
            cachedWorkingModel = modelName;
            console.log(`⚡ [Gemini Fast Client] Sucesso via REST com ${modelName}!`);
            return extracted;
          }
        } else {
          const errText = await res.text();
          const restHttpErrLog = `[REST_HTTP_${res.status} - ${modelName}: ${errText.slice(0, 100)}]`;
          console.log(`⚠️ [Gemini Client] ${restHttpErrLog}`);
          lastErrors.push(restHttpErrLog);
        }
      } catch (restErr) {
        const restNetErrLog = `[REST_NET_ERROR - ${modelName}]`;
        console.log(`⚠️ [Gemini Client] ${restNetErrLog}`);
        lastErrors.push(restNetErrLog);
      }
    }
  }

  const failureReason = `FALHA_CONEXAO_GEMINI: Todas as tentativas com a API do Gemini falharam no servidor. Erros registrados: ${lastErrors.join(" | ")}`;
  console.error("❌ " + failureReason);
  return generateSmartFallback(lastUserText, history, failureReason);
}

// Função de streaming de texto do Gemini em tempo real
async function callGeminiStream(contents, systemInstruction, onTextChunk, history = []) {
  let lastUserText = "";
  if (Array.isArray(contents) && contents.length > 0) {
    const lastItem = contents[contents.length - 1];
    if (typeof lastItem === "string") {
      lastUserText = lastItem;
    } else if (lastItem.parts && Array.isArray(lastItem.parts) && lastItem.parts[0]) {
      lastUserText = lastItem.parts[0].text || "";
    } else if (lastItem.text) {
      lastUserText = lastItem.text;
    }
  }

  const currentKey = getCurrentKey();
  if (!currentKey) {
    const errorDetails = "GEMINI_API_KEY_MISSING: Chave GEMINI_API_KEY não configurada.";
    const fb = generateSmartFallbackObject(lastUserText, history, errorDetails);
    if (onTextChunk && fb.response) {
      onTextChunk(fb.response);
    }
    return JSON.stringify(fb);
  }

  const responseSchemaDef = {
    type: Type.OBJECT,
    properties: {
      response: {
        type: Type.STRING,
        description: "A resposta do Dr. Miau em português de 2 a 4 frases felinas amigáveis e acolhedoras."
      },
      sentiment: {
        type: Type.STRING,
        enum: ["alegre", "neutro", "preocupado", "protetor", "confuso"],
        description: "A emoção correspondente do avatar: alegre, neutro, preocupado, protetor, confuso"
      },
      phase: {
        type: Type.INTEGER,
        description: "A fase atual da entrevista (1, 2 ou 3)."
      },
      progress: {
        type: Type.INTEGER,
        description: "O progresso acumulado da entrevista de 0 a 100."
      },
      trigger_video_generation: {
        type: Type.BOOLEAN,
        description: "Defina como true apenas quando todas as 3 fases forem concluídas com sucesso."
      },
      video_prompt: {
        type: Type.STRING,
        description: "O prompt sintetizado detalhado em inglês para o Magic Hour, ou string vazia se trigger_video_generation for false."
      }
    },
    required: ["response", "sentiment", "phase", "progress", "trigger_video_generation", "video_prompt"]
  };

  // Modelos suportados oficiais em ordem de velocidade e resiliência de cota
  const baseModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  const modelsToTry = Array.from(new Set([cachedWorkingModel, ...baseModels]));

  for (const modelName of modelsToTry) {
    try {
      const ai = new GoogleGenAI({ apiKey: currentKey });
      const streamResult = await ai.models.generateContentStream({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchemaDef,
          maxOutputTokens: 350,
          temperature: 0.7,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW
          }
        }
      });

      let accumulatedRaw = "";
      let streamedResponseLength = 0;

      for await (const chunk of streamResult) {
        const text = chunk.text || "";
        accumulatedRaw += text;

        const match = accumulatedRaw.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)/);
        if (match && match[1]) {
          const currentExtracted = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
          if (currentExtracted.length > streamedResponseLength) {
            const delta = currentExtracted.slice(streamedResponseLength);
            streamedResponseLength = currentExtracted.length;
            if (onTextChunk && delta) {
              onTextChunk(delta);
            }
          }
        }
      }

      if (accumulatedRaw.trim()) {
        cachedWorkingModel = modelName;
        console.log(`⚡ [Gemini Stream Client] Stream concluído com sucesso via ${modelName}!`);
        return accumulatedRaw;
      }
    } catch (streamErr) {
      console.warn(`⚠️ [Gemini Stream Client] Erro no stream com ${modelName}:`, streamErr.message?.slice(0, 100));
    }
  }

  // Fallback rápido
  const regularResponse = await callGemini(contents, systemInstruction, history);
  try {
    const p = typeof regularResponse === "string" ? JSON.parse(regularResponse) : regularResponse;
    if (onTextChunk && p.response) {
      onTextChunk(p.response);
    }
  } catch {
    if (onTextChunk && regularResponse) {
      onTextChunk(regularResponse);
    }
  }
  return regularResponse;
}

function cleanPortugueseText(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/\bd!!a\b/gi, "dá")
    .replace(/\bd!!\b/gi, "dá")
    .replace(/\bT!!o\b/g, "Tão")
    .replace(/\bt!!o\b/g, "tão")
    .replace(/\bvoc!!\b/gi, "você")
    .replace(/\bc!!ozinho\b/gi, "cãozinho")
    .replace(/\bc!!es\b/gi, "cães")
    .replace(/\bc!!o\b/gi, "cão")
    .replace(/\bxod!!\b/gi, "xodó")
    .replace(/\best!!o\b/gi, "estão")
    .replace(/\best!!\b/gi, "está")
    .replace(/\bs!!o\b/gi, "são")
    .replace(/\bn!!o\b/gi, "não")
    .replace(/\btamb!!m\b/gi, "também")
    .replace(/\bat!!\b/gi, "até")
    .replace(/\bol!!\b/gi, "olá")
    .replace(/\bj!!\b/gi, "já")
    .replace(/\bs!!\b/gi, "só")
    .replace(/\btr!!s\b/gi, "três")
    .replace(/\bqu!!\b/gi, "quê")
    .replace(/\bqual !!\b/gi, "qual é")
    .replace(/\bque !!\b/gi, "que é")
    .replace(/ !! /g, " é ")
    .replace(/^!! /g, "É ")
    .replace(/ !!$/g, " é")
    .replace(/cora!!o/gi, "coração")
    .replace(/a!!o/gi, "ação")
    .replace(/!!a/g, "á")
    .replace(/!!o/g, "ão")
    .replace(/!!e/g, "ê")
    .replace(/!!i/g, "í")
    .replace(/!!u/g, "ú")
    .replace(/!!/g, "é");
}

const BREED_RELEVANT_SPECIES = [
  "cachorro", "cachorra", "cadela", "cão", "cao", "cãozinho", "caozinho", "dog", "doguinho", "filhote", "canino",
  "gato", "gata", "gatinho", "gatinha", "felino", "cat", "bichano",
  "cavalo", "égua", "egua", "potro", "potrinho", "equino"
];

const NON_BREED_SPECIES = [
  "peixe", "peixinho", "betta", "carpa", "kinguio", "lebiste", "tetra", "guppy", "baiacu",
  "coelho", "coelha", "coelhinho", "coelhinha",
  "calopsita", "canário", "canario", "periquito", "papagaio", "arara", "cacatua", "ave", "pássaro", "passarinho",
  "elefante", "elefanta", "elefantinho", "tartaruga", "jabuti", "cágado", "hamster", 
  "porquinho-da-índia", "porquinho da índia", "porquinho da india", "chinchila", "furão", "furao", 
  "iguana", "cobra", "serpente", "lagarto", "sapo", "camaleão", "camaleao", "leão", "leao", "leoa", 
  "tigre", "urso", "macaco", "girafa", "zebra", "jacaré", "jacare", "pinguim", "panda", "lobo", "raposa",
  "bode", "cabra", "ovelha", "porco", "porquinho", "vaca", "boi", "preguiça", "rinoceronte", "hipopótamo"
];

function translateToEnglishCinematicTerms(petType, petBreed, coatColor, scenarioText, actionText, petName) {
  const name = petName || "our cute hero";
  
  // Mapeamento de tipo de animal
  const typeMap = {
    "peixe": "goldfish",
    "peixinho": "little cute tropical fish",
    "betta": "magnificent Betta fish",
    "carpa": "majestic koi fish",
    "kinguio": "cute round goldfish",
    "cachorro": "adorable dog",
    "cachorra": "adorable dog",
    "cão": "adorable puppy dog",
    "cao": "adorable puppy dog",
    "dog": "playful dog",
    "doguinho": "sweet little puppy",
    "gato": "fluffy adorable cat",
    "gata": "sweet charming cat",
    "gatinho": "tiny playful kitten",
    "coelho": "fluffy cute bunny rabbit",
    "cavalo": "majestic gentle horse",
    "calopsita": "colorful cockatiel bird",
    "papagaio": "vibrant parrot",
    "passaro": "little sweet bird",
    "pássaro": "little sweet bird",
    "tartaruga": "cute friendly turtle",
    "hamster": "chubby little hamster"
  };

  const rawType = (petType || "").toLowerCase().trim();
  let enPetType = "adorable pet";
  for (const [pt, en] of Object.entries(typeMap)) {
    if (rawType.includes(pt)) {
      enPetType = en;
      break;
    }
  }

  // Mapeamento de cores
  const colorMap = {
    "vermelho": "radiant ruby red and vibrant shimmering scales",
    "vermelha": "radiant ruby red and vibrant shimmering scales",
    "azul": "vibrant royal blue with glowing tones",
    "amarelo": "bright sunny golden yellow",
    "dourado": "shimmering metallic gold",
    "preto": "sleek velvety midnight black",
    "branco": "pure snowy white",
    "laranja": "warm bright glowing orange",
    "caramelo": "warm golden caramel",
    "marrom": "rich warm chocolate brown",
    "cinza": "soft silver grey",
    "rajado": "expressive striped tabby pattern",
    "malhado": "spotted charming coat",
    "tricolor": "colorful three-tone pattern"
  };

  const rawColor = (coatColor || "").toLowerCase().trim();
  let enColor = "vibrant beautiful colors";
  for (const [pt, en] of Object.entries(colorMap)) {
    if (rawColor.includes(pt)) {
      enColor = en;
      break;
    }
  }

  // Mapeamento de cenário
  let enScenario = "in a charming, cozy, beautifully lit sun-drenched home setting";
  const rawScen = (scenarioText || "").toLowerCase().trim();
  if (rawScen.includes("praia") || rawScen.includes("mar") || rawScen.includes("oceano")) {
    enScenario = "on a stunning sun-kissed tropical beach with sparkling crystal-clear waters and golden sands";
  } else if (rawScen.includes("floresta") || rawScen.includes("bosque") || rawScen.includes("árvores")) {
    enScenario = "inside an enchanted magical fairy-tale forest illuminated by soft fireflies and sunbeams";
  } else if (rawScen.includes("jardim") || rawScen.includes("flores") || rawScen.includes("parque")) {
    enScenario = "in a lush blooming colorful garden overflowing with vibrant magical flowers";
  } else if (rawScen.includes("espaço") || rawScen.includes("espaco") || rawScen.includes("galáxia") || rawScen.includes("estrelas")) {
    enScenario = "floating weightlessly through a breathtaking cosmic galaxy surrounded by glittering stars and colorful nebulae";
  } else if (rawScen.includes("castelo") || rawScen.includes("reino")) {
    enScenario = "inside a grand enchanted royal fantasy castle hall with warm glowing chandeliers";
  } else if (rawScen.includes("cidade") || rawScen.includes("casa") || rawScen.includes("sala")) {
    enScenario = rawType.includes("peixe") 
      ? "inside a cozy modern sunlit home, swimming joyfully in a sparkling crystal-clear decorated aquarium" 
      : "inside a warm sunlit cozy modern living room with soft comfortable aesthetic decor";
  }

  // Mapeamento de ação
  let enAction = "enjoying a wonderful joyful moment with lively expressive animations";
  const rawAct = (actionText || "").toLowerCase().trim();
  if (rawType.includes("peixe")) {
    enAction = "swimming with graceful joyful acrobatic spins and blowing magical glowing water bubbles";
  } else if (rawAct.includes("correr") || rawAct.includes("correndo") || rawAct.includes("brincar")) {
    enAction = "running happily and bouncing around with boundless excitement and pure joy";
  } else if (rawAct.includes("dormir") || rawAct.includes("soneca") || rawAct.includes("deitado")) {
    enAction = "curled up cozily taking a peaceful sweet nap with soft gentle breathing animations";
  } else if (rawAct.includes("skate") || rawAct.includes("voar") || rawAct.includes("heroi") || rawAct.includes("herói")) {
    enAction = "performing dynamic energetic heroic moves with playful cinematic flair";
  }

  return `A breathtaking 3D Pixar-Disney style cinematic animation of an adorable ${enPetType} named ${name} with ${enColor}, ${enAction} ${enScenario}. Soft volumetric lighting, expressive facial animation, joyful and whimsical mood, ultra-detailed 8k render, masterpiece cinematography.`;
}

function analyzePetProfile(history = [], currentMessage = "") {
  const turns = [];
  if (Array.isArray(history)) {
    history.forEach(h => {
      if (h && h.text && h.text !== INITIAL_MESSAGE && h.text !== ALT_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE_2) {
        turns.push({
          role: (h.role === "user" || h.role === "User" || h.role === "Voce") ? "user" : "assistant",
          text: h.text
        });
      }
    });
  }
  if (currentMessage) {
    turns.push({ role: "user", text: currentMessage });
  }

  const userTurns = turns.filter(t => t.role === "user");
  const userTexts = userTurns.map(t => t.text.toLowerCase());
  const combinedUserText = userTexts.join(" ");

  // 1. ESPÉCIE / QUAL É O ANIMAL DE ESTIMAÇÃO (gato, cachorro, peixe, cavalo, elefante...)
  let hasPetType = false;
  let petType = null;
  let isBreedRelevant = true; // Por padrão até descobrir a espécie

  for (const s of BREED_RELEVANT_SPECIES) {
    const reg = new RegExp(`\\b${s}\\b`, "i");
    if (reg.test(combinedUserText)) {
      hasPetType = true;
      petType = s;
      isBreedRelevant = true;
      break;
    }
  }

  if (!hasPetType) {
    for (const s of NON_BREED_SPECIES) {
      const reg = new RegExp(`\\b${s}\\b`, "i");
      if (reg.test(combinedUserText)) {
        hasPetType = true;
        petType = s;
        isBreedRelevant = false;
        break;
      }
    }
  }

  // Detecção via imagem do agente de visão
  if (!hasPetType) {
    if (combinedUserText.includes("cão") || combinedUserText.includes("cao") || combinedUserText.includes("cachorro")) {
      hasPetType = true;
      petType = "cachorro";
      isBreedRelevant = true;
    } else if (combinedUserText.includes("gato") || combinedUserText.includes("felino")) {
      hasPetType = true;
      petType = "gato";
      isBreedRelevant = true;
    }
  }

  // 2. NOME DO ANIMALZINHO (SEMPRE OBRIGATÓRIO)
  let hasPetName = false;
  let petName = null;

  const namePatterns = [
    /(?:se\s+chama|chama-se|o\s+nome\s+(?:dele|dela|do\s+bicho|do\s+pet|do\s+meu\s+pet)?\s*(?:é|e)|chamo\s+(?:ele|ela)\s+de|nome:\s*|o\s+nome\s+é|chama\s+)\s*([a-záàâãéèêíïóôõöúçñ]+)/i,
    /(?:ele|ela)\s+é\s+o\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
    /(?:meu|minha)\s+(?:gato|gata|cachorro|cadela|cão|cao|coelho|elefante|peixe|cavalo)\s+([a-záàâãéèêíïóôõöúçñ]+)/i
  ];

  for (const pat of namePatterns) {
    const match = combinedUserText.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const forbiddenWords = ["um", "uma", "o", "a", "meu", "minha", "ele", "ela", "que", "de", "da", "do", "com", "muito", "bem", "não", "nao", "sim"];
      if (!forbiddenWords.includes(candidate.toLowerCase()) && candidate.length >= 2) {
        hasPetName = true;
        petName = candidate;
        break;
      }
    }
  }

  // Se o usuário disser explicitamente que não tem nome
  if (!hasPetName) {
    if (/(?:não|nao)\s+(?:tem|escolhi|coloquei|temos)\s+nome|sem\s+nome|ainda\s+(?:não|nao)\s+tem\s+nome/i.test(combinedUserText)) {
      hasPetName = true;
      petName = "sem nome definido ainda";
    }
  }

  // Contextual QA: se o assistente perguntou o nome na rodada anterior e o usuário respondeu diretamente
  if (!hasPetName) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askNameReg = /(?:qual\s+(?:é\s+o\s+)?nome|como\s+(?:ele|ela)\s+se\s+chama|o\s+nome\s+dele|o\s+nome\s+dela|qual\s+o\s+nome)/i;
        if (askNameReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().replace(/[.!?]+$/, "");
          const words = userReply.split(/\s+/);
          if (words.length <= 4 && !/(?:não\s+sei|depois|cenário|ação|praia|vídeo)/i.test(userReply)) {
            hasPetName = true;
            petName = userReply;
            break;
          }
        }
      }
    }
  }

  // 3. RAÇA (SE FOR GATO, CACHORRO, PEIXE, CAVALO ETC. PERGUNTA RAÇA; SE FOR ELEFANTE OU ANIMAL SEM RAÇAS FAMOSAS, NÃO PERGUNTA)
  let hasBreed = false;
  let petBreed = null;

  if (!isBreedRelevant) {
    hasBreed = true;
    petBreed = "não se aplica (animal sem raças conhecidas)";
  } else {
    const breedPatterns = [
      /(?:vira[\s-]?lata|srd|sem\s+ra[çc]a|mistura|mesti[çc]o|misturadinho|n[ãa]o\s+tem\s+ra[çc]a|n[ãa]o\s+sei\s+a\s+ra[çc]a|n[ãa]o\s+sei|desconhecida|comum)/i,
      /(?:poodle|golden|retriever|labrador|pitbull|pit\s*bull|bulldog|buldogue|shih[\s-]?tzu|shitzu|beagle|pastor|rottweiler|husky|siberiano|dachshund|teckel|salsicha|pinscher|yorkshire|yorkie|malt[eê]s|border\s+collie|chihuahua|chow[\s-]?chow|d[aá]lmata|boxer|pug|spitz|lulu|doberman|dogue|cocker|akita|bernese|lhasa|schnauzer|basset|corgi|samoieda|fila|cane\s+corso|fox|weimaraner|whippet)/i,
      /(?:siam[eê]s|persa|maine\s+coon|bengal|sphynx|ragdoll|angor[aá]|british|azul\s+russo|bombaim|siberiano|munchkin|chartreux|birman[eê]s)/i,
      /(?:mangalarga|quarto\s+de\s+milha|puro\s+sangue|[aá]rabe|crioulo|campolina|pampa|bret[aã]o)/i,
      /(?:betta|carpa|kinguio|lebiste|tetra|guppy|acar[aá]|palha[çc]o|baiacu)/i,
      /(?:lionhead|mini\s+lop|holand[eê]s)/i,
      /(?:calopsita|can[aá]rio|periquito|agapornis|cacatua)/i,
      /(?:ra[çc]a\s*(?:é|e|:)?\s*([a-záàâãéèêíïóôõöúçñ\s]+))/i
    ];

    for (const pat of breedPatterns) {
      const match = combinedUserText.match(pat);
      if (match) {
        hasBreed = true;
        petBreed = match[1] || match[0];
        break;
      }
    }

    if (!hasBreed) {
      for (let i = 0; i < turns.length - 1; i++) {
        const turn = turns[i];
        const nextTurn = turns[i + 1];
        if (turn.role === "assistant" && nextTurn.role === "user") {
          const askBreedReg = /(?:qual\s+(?:é\s+a\s+)?ra[çc]a|qual\s+a\s+ra[çc]a|de\s+qual\s+ra[çc]a|é\s+de\s+ra[çc]a|vira-lata)/i;
          if (askBreedReg.test(turn.text)) {
            const userReply = nextTurn.text.trim().replace(/[.!?]+$/, "");
            const words = userReply.split(/\s+/);
            if (words.length <= 5 && !/(?:cenário|praia|vídeo|ação)/i.test(userReply)) {
              hasBreed = true;
              petBreed = userReply;
              break;
            }
          }
        }
      }
    }
  }

  // 4. COLORAÇÃO DE PELE OU PELOS (SEMPRE OBRIGATÓRIO)
  let hasCoatColor = false;
  let coatColor = null;

  const colorKeywords = [
    "preto", "preta", "pretos", "pretas", "pretinho", "pretinhos", "pretinha", "pretinhas", "negro", "negros", "negra", "negras",
    "branco", "branca", "brancos", "brancas", "branquinho", "branquinhos", "branquinha", "branquinhas", "alvo",
    "marrom", "marrons", "castanho", "castanhos", "castanha", "castanhas", "chocolate", "caramelo", "caramelos", "dourado", "dourados", "dourada", "douradas", "amarelo", "amarelos", "amarela", "amarelas",
    "cinza", "cinzas", "cinzento", "cinzentos", "cinzenta", "cinzentas", "acinzentado", "acinzentados", "azul", "azuis", "azulado", "vermelho", "vermelhos", "vermelha", "vermelhas", "ruivo", "ruivos", "ruiva", "ruivas", "laranja", "laranjas", "alaranjado",
    "rajado", "rajados", "rajada", "rajadas", "tigrado", "tigrados", "tigrada", "tigradas", "mesclado", "mesclados", "mesclada", "mescladas", "tricolor", "tricolores", "bicolor", "bicolores", "malhado", "malhados", "malhada", "malhadas",
    "creme", "cremes", "bege", "beges", "chumbo", "prateado", "prateados", "prata", "camurça", "tostado", "baio"
  ];

  for (const c of colorKeywords) {
    const reg = new RegExp(`\\b${c}\\b`, "i");
    if (reg.test(combinedUserText)) {
      hasCoatColor = true;
      coatColor = c;
      break;
    }
  }

  if (!hasCoatColor) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askColorReg = /(?:cor\s+(?:dos\s+pelos|da\s+pelagem|da\s+pele|dele|dela)|colora[çc][ãa]o)/i;
        if (askColorReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().replace(/[.!?]+$/, "");
          const words = userReply.split(/\s+/);
          if (words.length <= 5 && !/(?:cenário|praia|vídeo)/i.test(userReply)) {
            hasCoatColor = true;
            coatColor = userReply;
            break;
          }
        }
      }
    }
  }

  // 5. SE O ANIMAL POSSUI ALGUMA AVARIAÇÃO, SEJA MANCHAS, ALGUMA DEFICIÊNCIA ETC. (SEMPRE OBRIGATÓRIO)
  let hasAvariacao = false;
  let avariacao = null;

  const avariacaoPresenceKeywords = [
    "mancha", "manchas", "manchinha", "manchinhas", "manchado", "manchada",
    "pinta", "pintas", "pintinhas", "listra", "listras", "listrado", "listrada", "sardas",
    "deficiência", "deficiencia", "deficiente", "cego", "ceguinho", "sem um olho", "caolho",
    "sem uma pata", "sem pata", "perneta", "manco", "manca", "mancando", "três patas", "3 patas",
    "duas patas", "2 patas", "surdo", "surdinho", "sem orelha", "orelha caída", "orelha torta",
    "orelha cortada", "rabinho curto", "sem rabo", "sem cauda", "cauda curta", "cicatriz",
    "cicatrizes", "machucado", "cadeirante", "cadeira de rodas", "amputado", "amputada"
  ];

  for (const a of avariacaoPresenceKeywords) {
    if (combinedUserText.includes(a)) {
      hasAvariacao = true;
      avariacao = a;
      break;
    }
  }

  if (!hasAvariacao) {
    const avariacaoNegativePatterns = [
      /(?:n[ãa]o\s+tem|sem)\s+(?:nenhuma\s+)?(?:mancha|manchas|defici[êe]ncia|avaria[çc][ãa]o|marca|marcas|cicatriz)/i,
      /(?:nenhuma\s+mancha|nenhuma\s+defici[êe]ncia|nenhuma\s+avaria[çc][ãa]o|nada\s+disso|n[ãa]o\s+tem\s+nada|ele\s+[eé]\s+perfeito|100%\s+perfeito|perfeitinho|tudo\s+normal|ele\s+[eé]\s+normal|cor\s+lisa|lisinho|sem\s+marcas|sadio|saud[aá]vel|completinho)/i
    ];
    for (const pat of avariacaoNegativePatterns) {
      if (pat.test(combinedUserText)) {
        hasAvariacao = true;
        avariacao = "nenhuma (sem marcas/perfeito)";
        break;
      }
    }
  }

  if (!hasAvariacao) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askAvariacaoReg = /(?:avaria[çc][ãa]o|mancha|manchas|defici[êe]ncia|cicatriz|marca\s+especial)/i;
        if (askAvariacaoReg.test(turn.text)) {
          const userReply = nextTurn.text.trim();
          hasAvariacao = true;
          avariacao = userReply;
          break;
        }
      }
    }
  }

  // 6. HISTÓRIA DO TUTOR COM O ANIMAL (COMO SE CONHECERAM, ADOÇÃO, MEMÓRIAS, TRAVESSURAS)
  let hasPetStory = false;
  let petStory = null;

  const storyKeywords = [
    "adot", "resgat", "achei", "encontrei", "comprei", "ganhei", "rua", "filhote", "filhotinho", "bebê",
    "história", "historia", "conheci", "conhecemos", "trouxe", "anos juntos", "meses juntos", "dia em que",
    "lembro", "memória", "primeira vez", "apaixonei", "amor", "grude", "dorme comigo", "companheiro", "companheira",
    "mudou minha vida", "travessura", "apronta", "brincalhão", "carinhoso", "fofinho", "resgate", "abrigo", "feira de adoção",
    "doação", "doaram", "veio pra casa", "apareceu", "adotivo", "adotiva"
  ];

  for (const sk of storyKeywords) {
    if (combinedUserText.includes(sk)) {
      hasPetStory = true;
      petStory = "história compartilhada pelo tutor";
      break;
    }
  }

  if (!hasPetStory) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askStoryReg = /(?:hist[oó]ria|como\s+(?:voc[êe]s\s+)?se\s+conheceram|como\s+ele\s+chegou|dia\s+em\s+que|momento\s+marcante|travessura|como\s+foi\s+quando|adot|resgat)/i;
        if (askStoryReg.test(turn.text)) {
          const userReply = nextTurn.text.trim();
          if (userReply.length >= 3) {
            hasPetStory = true;
            petStory = userReply;
            break;
          }
        }
      }
    }
  }

  const missingParams = [];
  if (!hasPetName) missingParams.push("Nome do animal");
  if (!hasPetType) missingParams.push("Tipo do animal (gato, cachorro, cavalo, peixe, elefante...)");
  if (isBreedRelevant && !hasBreed) missingParams.push("Raça (ou confirmação de vira-lata/SRD)");
  if (!hasCoatColor) missingParams.push("Coloração de pele ou pelos");
  if (!hasAvariacao) missingParams.push("Avariações ou características marcantes (manchas, cicatriz, deficiência ou confirmação de que não possui)");
  if (!hasPetStory) missingParams.push("História do tutor com o animal (como se conheceram, memórias, travessuras)");

  const isPhase1Complete = hasPetType && hasPetName && hasBreed && hasCoatColor && hasAvariacao && hasPetStory;

  const checklistText = `
- 1. Nome do animal: ${hasPetName ? `✅ CONHECIDO ("${petName}")` : "❌ PENDENTE (Perguntar o nome do animalzinho)"}
- 2. Tipo do animal: ${hasPetType ? `✅ CONHECIDO ("${petType}")` : "❌ PENDENTE (Perguntar qual é o animal: gato, cachorro, elefante...)"}
- 3. História do tutor com o pet: ${hasPetStory ? `✅ CONHECIDA ("${petStory}")` : "❌ PENDENTE (Perguntar como se conheceram, como foi a chegada dele ou momentos marcantes)"}
- 4. Raça: ${!isBreedRelevant ? "➖ NÃO SE APLICA (animal sem raças conhecidas)" : hasBreed ? `✅ CONHECIDO ("${petBreed}")` : "❌ PENDENTE (Perguntar a raça ou se é vira-lata)"}
- 5. Coloração da pele, pelagem ou plumagem: ${hasCoatColor ? `✅ CONHECIDO ("${coatColor}")` : "❌ PENDENTE (Perguntar a cor da pele ou pelos)"}
- 6. Variação ou característica marcante: ${hasAvariacao ? `✅ CONHECIDO ("${avariacao}")` : "❌ PENDENTE (Perguntar se possui manchas, deficiência, cicatriz ou se é sem marcas especiais)"}
`.trim();

  return {
    hasPetType,
    petType,
    isBreedRelevant,
    hasBreed,
    petBreed,
    hasPetName,
    petName,
    hasCoatColor,
    coatColor,
    hasAvariacao,
    avariacao,
    hasPetStory,
    petStory,
    missingParams,
    isPhase1Complete,
    checklistText
  };
}

function evaluateConversationState(history = [], currentMessage = "") {
  const userTexts = [];
  if (Array.isArray(history)) {
    history.forEach(h => {
      if (h && h.text && (h.role === "user" || h.role === "User" || h.role === "Voce")) {
        userTexts.push(h.text.toLowerCase());
      }
    });
  }
  if (currentMessage) {
    userTexts.push(currentMessage.toLowerCase());
  }
  const combinedUserText = userTexts.join(" ");

  const isDanone = combinedUserText.includes("danone");
  if (isDanone) {
    return {
      hasPetDetails: true,
      hasScenarioDetails: true,
      hasActionDetails: true,
      maxAllowedPhase: 3,
      suggestedProgress: 100,
      canTriggerVideo: true,
      isDanone: true,
      userMessagesCount: userTexts.length,
      petProfile: {
        hasPetType: true,
        petType: "pet danone",
        isBreedRelevant: false,
        hasBreed: true,
        petBreed: "especial",
        hasPetName: true,
        petName: "Danone",
        hasCoatColor: true,
        coatColor: "mágico",
        hasAvariacao: true,
        avariacao: "nenhuma",
        missingParams: [],
        isPhase1Complete: true,
        checklistText: "Código Danone ativado."
      }
    };
  }

  // Análise detalhada dos 5 parâmetros obrigatórios da Fase 1
  const petProfile = analyzePetProfile(history, currentMessage);
  const hasPetDetails = petProfile.isPhase1Complete;

  // Limpa descrições geradas pelo agente de visão da Parte 1 para não contaminar a detecção de Cenário e Ação
  const userTextsClean = userTexts.map(text => {
    return text
      .replace(/\[imagem analisada pelo agente de visão[^]*?\]:[^]*?(\n\ncomentário do usuário:|$)/gi, " ")
      .replace(/\[foto do pet enviada pelo tutor[^]*?\]:[^]*?(\n\ncomentário do usuário:|$)/gi, " ");
  });
  const combinedUserTextClean = userTextsClean.join(" ");

  // 1. ANÁLISE DE CENÁRIO (FASE 2)
  const scenarioKeywords = [
    "praia", "floresta", "espaço", "espaco", "castelo", "nuvens", "mar", "montanha",
    "parte 2 - o cenário", "universo", "lua", "planeta", "neve", "piscina", "mundo de doces",
    "cidade", "campo", "campo de flores", "reino", "na praia", "na floresta", "no espaço", "no castelo",
    "no jardim", "no cenario", "no cenário", "cenário de", "cenario de", "fundo de", "quero na", "quero no",
    "sala", "quarto", "cozinha", "parque", "quintal", "rua", "casa", "lago", "rio", "fazenda",
    "céu", "ceu", "galáxia", "nave", "arco-íris", "montanhas"
  ];
  let hasScenarioDetails = scenarioKeywords.some(kw => combinedUserTextClean.includes(kw));

  // Turns do diálogo para inferência contextual
  const turns = [];
  if (Array.isArray(history)) {
    history.forEach(h => {
      if (h && h.text && h.text !== INITIAL_MESSAGE && h.text !== ALT_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE_2) {
        turns.push({
          role: (h.role === "user" || h.role === "User" || h.role === "Voce") ? "user" : "assistant",
          text: h.text
        });
      }
    });
  }
  if (currentMessage) {
    turns.push({ role: "user", text: currentMessage });
  }

  let scenarioTurnIndex = -1;
  for (let i = 0; i < turns.length - 1; i++) {
    const t = turns[i];
    const next = turns[i + 1];
    if (t.role === "assistant" && next.role === "user") {
      if (/(?:cen[aá]rio|lugar|ambiente|onde\s+(?:voc[êe]\s+)?gostaria|em\s+qual\s+(?:lugar|cen[aá]rio))/i.test(t.text)) {
        if (next.text && next.text.trim().length >= 2) {
          hasScenarioDetails = true;
          scenarioTurnIndex = i + 1;
          break;
        }
      }
    }
  }

  // 2. ANÁLISE DE AÇÃO (FASE 3) — ACEITA QUALQUER COISA QUE O TUTOR DISSER!
  let hasActionDetails = false;

  // Se o assistente perguntou sobre a ação do vídeo, QUALQUER resposta do usuário é aceita!
  for (let i = 0; i < turns.length - 1; i++) {
    const t = turns[i];
    const next = turns[i + 1];
    if (t.role === "assistant" && next.role === "user") {
      if (/(?:qual\s+a[çc][ãa]o|a[çc][ãa]o\s+voc[êe]\s+gostaria|fazendo\s+no\s+v[íi]deo|o\s+que\s+gostaria\s+de\s+ver|qualquer\s+a[çc][ãa]o|o\s+que\s+ele\s+vai\s+fazer|que\s+a[çc][ãa]o|fazendo\s+o\s+que|o\s+que\s+voc[êe]\s+gostaria\s+de\s+ver\s+o)/i.test(t.text)) {
        if (next.text && next.text.trim().length >= 2) {
          hasActionDetails = true;
          break;
        }
      }
    }
  }

  // Lista ampla de verbos ou palavras de ação (cotidiana, esportiva, mágica, livre)
  const actionKeywords = [
    "ação", "acao", "fazendo", "fazer", "brincar", "brincando", "correr", "correndo",
    "pular", "pulando", "dormir", "dormindo", "comer", "comendo", "explorar", "explorando",
    "passear", "passeando", "nadar", "nadando", "deitar", "deitando", "farejar", "farejando",
    "latir", "latindo", "miar", "miando", "rolar", "rolando", "cavar", "cavando", "skate",
    "andando", "andar", "voar", "voando", "dançar", "dancar", "dançando", "saltar", "saltando",
    "caçar", "caçando", "morder", "mordendo", "perseguir", "pegando", "pegar", "assistir",
    "beber", "bebendo", "subir", "subindo", "descer", "descendo", "lutar", "lutando",
    "salvar", "salvando", "mágica", "magica", "fogo", "raio", "festa", "sorvete", "pizza",
    "brinquedo", "bola", "bolinha", "laser", "cambalhota", "pirueta", "escondendo", "esconder",
    "abraçar", "abraçando", "carinho", "soneca", "sonequinha", "cochilar", "destruir", "destruindo",
    "pilotar", "pilotando", "bicicleta", "bike", "patins", "surfar", "surfando",
    "superpoder", "super poder", "super-poder", "parte 3 - o vídeo"
  ];
  if (!hasActionDetails && actionKeywords.some(kw => combinedUserTextClean.includes(kw))) {
    hasActionDetails = true;
  }

  // Se o Pet e o Cenário já estão estabelecidos, e o usuário enviou uma mensagem na fase 3:
  // qualquer resposta é aceita como a ação desejada!
  if (!hasActionDetails && hasPetDetails && hasScenarioDetails) {
    if (scenarioTurnIndex !== -1 && scenarioTurnIndex < turns.length - 1) {
      const subsequentTurns = turns.slice(scenarioTurnIndex + 1).filter(t => t.role === "user");
      if (subsequentTurns.length > 0) {
        hasActionDetails = true;
      }
    } else if (currentMessage && currentMessage.trim().length >= 2) {
      // Se já temos o cenário nos textos anteriores e a mensagem atual é um input válido
      hasActionDetails = true;
    }
  }

  const totalUserTurns = userTexts.length;

  let maxAllowedPhase = 1;
  let suggestedProgress = 10;
  let canTriggerVideo = false;

  // CÁLCULO ESTRITO DE PROGRESSO E FASE:
  // Enquanto qualquer parâmetro do pet estiver faltando, NUNCA sai da Fase 1
  if (!hasPetDetails) {
    maxAllowedPhase = 1;
    let completedCount = 0;
    if (petProfile.hasPetType) completedCount++;
    if (petProfile.hasPetName) completedCount++;
    if (petProfile.hasBreed) completedCount++;
    if (petProfile.hasCoatColor) completedCount++;
    if (petProfile.hasAvariacao) completedCount++;
    suggestedProgress = 5 + (completedCount * 6); // 5% a 35%
    canTriggerVideo = false;
  } else if (!hasScenarioDetails) {
    // Pet 100% conhecido, mas cenário ainda não definido: FASE 2
    maxAllowedPhase = 2;
    suggestedProgress = 50;
    canTriggerVideo = false;
  } else if (!hasActionDetails) {
    // Cenário definido, mas ação ainda não definida: FASE 3
    maxAllowedPhase = 3;
    suggestedProgress = 80;
    canTriggerVideo = false;
  } else {
    // Pet, Cenário e Ação todos definidos!
    maxAllowedPhase = 3;
    suggestedProgress = 100;
    canTriggerVideo = true;
  }

  return {
    hasPetDetails,
    hasScenarioDetails,
    hasActionDetails,
    maxAllowedPhase,
    suggestedProgress,
    canTriggerVideo,
    isDanone: false,
    userMessagesCount: totalUserTurns,
    petProfile
  };
}

function generateSmartFallbackObject(lastMessageText, history = [], apiErrorMsg = null) {
  const cleanedHistory = Array.isArray(history) 
    ? history.filter(h => h && h.text && h.text !== INITIAL_MESSAGE && h.text !== ALT_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE_2) 
    : [];

  const evalState = evaluateConversationState(cleanedHistory, lastMessageText);
  const pet = evalState.petProfile;

  let phase = evalState.maxAllowedPhase;
  let progress = evalState.suggestedProgress;
  let sentiment = "alegre";
  let response = "";
  let trigger_video_generation = evalState.canTriggerVideo;
  let video_prompt = trigger_video_generation ? `An adorable 3D Pixar-style animated scene of a cute ${pet.petType || "pet"} named ${pet.petName || "hero"} in an epic adventure. Vibrant lighting, ultra detailed 8k.` : "";

  const trimmedMsg = (lastMessageText || "").trim().toLowerCase();
  const isConfused = /^(?:n[ãa]o\s+sei|como\s+assim|o\s+que|qu[êe]|n[ãa]o\s+entendi|me\s+ajuda|n[ãa]o\s+compreendi|\?+$)/i.test(trimmedMsg);

  if (evalState.isDanone) {
    response = "Miau! Código especial Danone ativado! Pulei todas as etapas e estou enviando seu pedido para o estúdio de vídeo agora mesmo! 🚀🎬✨";
  } else if (isConfused) {
    sentiment = "alegre";
    trigger_video_generation = false;
    video_prompt = "";
    if (progress >= 100) progress = 85;
    const nameDisplay = pet.petName ? pet.petName : "seu amiguinho";
    if (!pet.isPhase1Complete) {
      response = `Miau! *ronrom* Fica super tranquilo, eu te ajudo! 🐾 Estamos apenas nos conhecendo com calma: você pode me contar qualquer detalhe do seu bichinho (como o nome dele, que animal ele é ou as cores dele). O que você gostaria de me contar primeiro? ✨`;
    } else if (!evalState.hasScenarioDetails) {
      response = `Miau! Não se preocupe, miauzinho! 🏖️🏰 O cenário é o lugar onde você imagina o ${nameDisplay} no vídeo: pode ser numa praia, num castelo, num jardim florido, voando pelo espaço sideral ou até na sala de casa! Onde você acha que seria legal?`;
    } else {
      response = `Miau! Pode deixar a imaginação rolar solta sem medo! 🎬🐾 Você pode escolher absolutamente QUALQUER ação para o ${nameDisplay}: desde brincar, correr ou tirar uma soneca, até andar de skate, caçar borboletas ou ser um super-herói! O que você mais gostaria de ver?`;
    }
  } else if (!pet.isPhase1Complete) {
    phase = 1;
    sentiment = "alegre";

    // Conduz a conversa com carinho, priorizando a história do tutor com o animal
    if (!pet.hasPetName) {
      response = "Miau! *ronrom* É uma alegria imensa conversar com você! Como está o seu dia? Me conta: qual é o nome do seu amiguinho de estimação e que animal ele é? 🐾✨";
    } else if (!pet.hasPetType) {
      const nameDisplay = pet.petName || "ele";
      response = `Que nome lindo, miau! Adorei! E que tipo de animalzinho é o ${nameDisplay}? É um gatinho, cãozinho, cavalo, coelho ou outro amiguinho? E como vocês se conheceram? 🐾✨`;
    } else if (!pet.hasPetStory) {
      const nameDisplay = pet.petName ? `o ${pet.petName}` : "ele";
      response = `Miau! Adorei conhecer ${nameDisplay}! *ronrom* 🐾 Me conta a história de vocês: como vocês se conheceram? Ele foi adotado, resgatado ou como ele chegou na sua vida? E qual a maior travessura ou momento marcante de vocês? ❤️✨`;
    } else if (pet.isBreedRelevant && !pet.hasBreed) {
      const nameDisplay = pet.petName ? `o ${pet.petName}` : "ele";
      const isDog = (pet.petType || "").toLowerCase().includes("cão") || (pet.petType || "").toLowerCase().includes("cachorro") || (pet.petType || "").toLowerCase().includes("dog");
      const isCat = (pet.petType || "").toLowerCase().includes("gato") || (pet.petType || "").toLowerCase().includes("felino");
      if (isDog) {
        response = `Que história linda, miau! 🐾 E me conta: qual é a raça d${nameDisplay}? Ou ele é um vira-latinha irresistível e carismático? ✨`;
      } else if (isCat) {
        response = `Que história emocionante, miau! 🐾 E qual é a raça d${nameDisplay}? Ou ele é um gatinho SRD charmoso? ✨`;
      } else {
        response = `Que fofura! E me conta: qual é a raça d${nameDisplay}? 🐾✨`;
      }
    } else if (!pet.hasCoatColor) {
      const nameDisplay = pet.petName ? pet.petName : "ele";
      const isFish = (pet.petType || "").toLowerCase().includes("peixe");
      if (isFish) {
        response = `Miau! Adoro peixinhos brilhantes! E quais são as cores das escamas e das nadadeiras do ${nameDisplay}? 🐠✨`;
      } else {
        response = `Adorei, miau! E como é a coloração da pelagem ou da pele do ${nameDisplay}? Que cores ele tem? 🎨🐾`;
      }
    } else if (!pet.hasAvariacao) {
      const nameDisplay = pet.petName ? pet.petName : "seu pet";
      response = `Que amor! E o ${nameDisplay} possui alguma manchinha charmosa, detalhe único ou característica marcante? 🐾✨`;
    } else {
      const nameDisplay = pet.petName ? pet.petName : "seu pet";
      response = `Miau! Estou apaixonado pela história do ${nameDisplay}! Me conta mais uma lembrança ou momento inesquecível de vocês juntos! 🐾❤️`;
    }
  } else if (!evalState.hasScenarioDetails) {
    phase = 2;
    sentiment = "alegre";
    const nameDisplay = pet.petName ? pet.petName : "seu amiguinho";
    const isFish = (pet.petType || "").toLowerCase().includes("peixe");
    if (isFish) {
      response = `Que maravilha, miau! Agora já conheço tudinho sobre o ${nameDisplay}! Para o nosso vídeo: onde você imagina o ${nameDisplay}? (Ex: num lindo aquário decorado com castelo no quarto, num recife de corais no oceano, ou voando num aquário mágico pelo espaço?) 🌊🐠🏰✨`;
    } else {
      response = `Que maravilha, miau! Agora já conheço tudinho sobre o ${nameDisplay}! Para a nossa próxima etapa: em qual cenário incrível você gostaria de vê-lo no vídeo? (Ex: numa praia ensolarada, num castelo encantado, numa floresta mágica ou na sala de casa?) 🏖️🏰✨`;
    }
  } else if (!evalState.hasActionDetails && (!lastMessageText || lastMessageText.trim().length < 2)) {
    phase = 3;
    sentiment = "alegre";
    const nameDisplay = pet.petName ? pet.petName : "seu amiguinho";
    const isFish = (pet.petType || "").toLowerCase().includes("peixe");
    if (isFish) {
      response = `Adorei esse cenário! E o que você gostaria de ver o ${nameDisplay} fazendo no vídeo? (Ex: nadando alegremente, soltando bolhas de água brilhantes, fazendo piruetas ou explorando um baú do tesouro?) 🎬🐠✨`;
    } else {
      response = `Adorei esse cenário! E agora me conta: qual ação você gostaria de ver o ${nameDisplay} fazendo no vídeo? Pode ser absolutamente qualquer coisa que você imaginar (como brincar, correr feliz, tirar uma sonequinha ou fazer algo mágico)! 🎬🐾`;
    }
  } else {
    // Ação fornecida pelo tutor ou qualquer input da fase 3: ACEITA QUALQUER COISA!
    phase = 3;
    progress = 100;
    trigger_video_generation = true;
    sentiment = "alegre";
    const nameDisplay = pet.petName ? pet.petName : "seu pet";
    const actionDesc = (lastMessageText && lastMessageText.trim().length >= 2) 
      ? lastMessageText.trim().replace(/[.!?]+$/, "") 
      : "fazendo algo muito divertido";
    response = `Miau! Que ideia miauravilhosa! Ver o ${nameDisplay} em ação vai ficar a coisa mais linda e divertida do mundo! 🎬🐾 Já reuni todos os detalhes: o pet, o cenário e a ação! Estou iniciando a geração da animação 3D agora mesmo! 🚀✨`;
    video_prompt = translateToEnglishCinematicTerms(
      pet.petType,
      pet.petBreed,
      pet.coatColor,
      evalState.scenarioText || "cozy home",
      actionDesc,
      pet.petName
    );
  }

  return {
    response,
    sentiment,
    phase,
    progress,
    trigger_video_generation,
    video_prompt,
    api_fallback_used: true,
    api_error_detail: apiErrorMsg || null
  };
}

function generateSmartFallback(lastMessageText, history = [], apiErrorMsg = null) {
  return JSON.stringify(generateSmartFallbackObject(lastMessageText, history, apiErrorMsg));
}

// Agente Especialista em Análise e Descrição de Imagens
async function analyzeImageWithAgent(imageBase64, mimeType = "image/jpeg", phase = 1) {
  const currentKey = getCurrentKey();
  if (!currentKey) {
    return "Imagem recebida! O amiguinho na foto parece ser muito fofo e carismático.";
  }

  let cleanBase64 = imageBase64;
  if (imageBase64.includes("base64,")) {
    cleanBase64 = imageBase64.split("base64,")[1];
  }

  let phaseInstruction = "";
  if (phase === 1) {
    phaseInstruction = "Sua missão nesta Parte 1 é descrever EXCLUSIVAMENTE O ANIMAL/PET presente na foto para alimentar o perfil do Dr. Miau. Detalhe com extrema precisão: 1) a espécie (gato, cão, pássaro, etc.), 2) raça (ou mistura de raças / vira-lata se aplicável), 3) cores exatas e padrões da pelagem ou pele (manchas, listras, degrade), 4) se possui alguma avariação, mancha marcante, cicatriz ou deficiência física visível. IGNORE COMPLETAMENTE O CENÁRIO OU AMBIENTE AO FUNDO (o cenário do vídeo será definido separadamente na Parte 2). Foque 100% apenas nas características físicas do pet.";
  } else if (phase === 2) {
    phaseInstruction = "Sua missão nesta Parte 2 é descrever EXCLUSIVAMENTE O CENÁRIO / AMBIENTE presente na foto. Detalhe com extrema precisão: elementos do fundo, móveis, vegetação, iluminação, cores do ambiente, decoração, estilo do lugar (praia, jardim, sala, campo). IGNORE O ANIMAL. Foque 100% no cenário!";
  } else {
    phaseInstruction = "Sua missão nesta Parte 3 é descrever a ação, postura, acessórios, roupinhas e energia do pet e do cenário presente na foto para compor o vídeo final.";
  }

  const systemInstruction = `Você é o Agente Especialista em Análise de Imagens do Estúdio Dr. Miau. Seu único papel é analisar fotos com altíssima precisão de detalhes e gerar uma descrição técnica e minuciosa em português do Brasil.
Sua descrição será repassada diretamente ao Dr. Miau para sintetizar o prompt de animação 3D.
Responda diretamente com a descrição detalhada em 3 a 5 frases ricas, objetivas e encantadoras.`;

  try {
    const ai = new GoogleGenAI({ apiKey: currentKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { inlineData: { mimeType: mimeType || "image/jpeg", data: cleanBase64 } },
            { text: phaseInstruction }
          ]
        }
      ],
      config: {
        systemInstruction: systemInstruction,
        maxOutputTokens: 400
      }
    });

    if (response && response.text) {
      return response.text.trim();
    }
  } catch (sdkErr) {
    console.log("[Vision Agent] Não foi possível chamar Gemini Vision (SDK). Tentando REST ou fallback local.");
    try {
      const isToken = currentKey.startsWith("ya29.");
      let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
      const headers = { "Content-Type": "application/json", "User-Agent": "aistudio-build" };
      if (isToken) {
        headers["Authorization"] = `Bearer ${currentKey}`;
      } else {
        apiUrl += `?key=${currentKey}`;
      }

      const payload = {
        contents: [
          {
            parts: [
              { inlineData: { mimeType: mimeType || "image/jpeg", data: cleanBase64 } },
              { text: phaseInstruction }
            ]
          }
        ],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { maxOutputTokens: 400 }
      };

      const res = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(payload) });
      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
      }
    } catch (restErr) {
      console.log("[Vision Agent] Fallback para descrição padrão ativado.");
    }
  }

  return "Imagem analisada: Pet adorável com feições marcantes e pelagem bem definida na foto.";
}

// Rota do Agente Especialista em Imagens
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { imageBase64, mimeType, phase } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Imagem em formato Base64 não fornecida." });
    }

    console.log(`[Vision Agent Request] Analisando foto para Parte ${phase || 1}...`);
    const description = await analyzeImageWithAgent(imageBase64, mimeType || "image/jpeg", Number(phase) || 1);
    console.log(`[Vision Agent Output]:`, description);

    res.json({
      success: true,
      phase: Number(phase) || 1,
      description: cleanPortugueseText(description)
    });
  } catch (err) {
    console.error("[Vision Agent Endpoint Error]:", err);
    res.status(500).json({
      error: err.message,
      description: "Imagem recebida com sucesso! O pet na foto é extremamente fofo e encantador."
    });
  }
});

// Função de suporte para iniciar a geração de vídeos na API Magic Hour
async function triggerMagicHourGeneration(prompt) {
  const apiKey = (getMagicHourKey() || "").trim();
  console.log(`[Magic Hour Trigger] Iniciando requisição para https://api.magichour.ai com prompt: "${prompt}"`);
  
  if (!apiKey || apiKey.includes("sua_chave_aqui")) {
    const err = new Error("MAGIC_HOUR_KEY_MISSING: A chave MAGIC_HOUR_API_KEY não foi configurada no ambiente do servidor (Vercel).");
    err.code = "MAGIC_HOUR_KEY_MISSING";
    throw err;
  }

  const payload = {
    name: "Dr Miau Video",
    style: {
      type: "text_to_video",
      prompt: prompt,
      aspect_ratio: "1:1"
    },
    aspect_ratio: "1:1",
    end_seconds: 2,
    height: 512,
    width: 512,
    fps: 15,
    end_to_end: true
  };
  
  let response;
  try {
    response = await fetch("https://api.magichour.ai/v1/text-to-video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (fetchErr) {
    const err = new Error(`MAGIC_HOUR_FETCH_FAILED: Erro de conexão de rede ao acessar api.magichour.ai: ${fetchErr.message}`);
    err.code = "MAGIC_HOUR_FETCH_FAILED";
    throw err;
  }
  
  if (!response.ok) {
    const errText = await response.text();
    let code = `MAGIC_HOUR_HTTP_${response.status}`;
    if (response.status === 401) code = "MAGIC_HOUR_AUTH_401 (Chave inválida)";
    if (response.status === 402) code = "MAGIC_HOUR_QUOTA_402 (Sem saldo/créditos)";
    if (response.status === 422) code = "MAGIC_HOUR_PARAMS_422 (Parâmetros inválidos)";

    const err = new Error(`[${code}] Erro na API Magic Hour (HTTP ${response.status}): ${errText}`);
    err.code = code;
    throw err;
  }
  
  try {
    const data = await response.json();
    console.log(`[Magic Hour Trigger] Sucesso! Job ID: ${data.id}, Status: ${data.status}`);
    
    // Atualiza o último prompt gerado para inspeção
    lastMagicHourPromptInfo = {
      prompt: prompt,
      timestamp: new Date().toISOString(),
      jobId: data.id,
      status: data.status,
      payload: payload
    };

    return data;
  } catch (jsonErr) {
    const err = new Error(`MAGIC_HOUR_BAD_JSON: Resposta JSON inválida retornada pela API: ${jsonErr.message}`);
    err.code = "MAGIC_HOUR_BAD_JSON";
    throw err;
  }
}

// Rota de Healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Rota para consultar o último prompt enviado ao Magic Hour
app.get("/api/last-prompt", (req, res) => {
  res.json(lastMagicHourPromptInfo);
});

// Rota para resetar o último prompt gerado quando o usuário inicia nova conversa
app.post("/api/reset-prompt", (req, res) => {
  lastMagicHourPromptInfo = {
    prompt: null,
    timestamp: null,
    jobId: null,
    status: null
  };
  console.log("[Prompt Reset] Histórico de prompt Magic Hour limpo com sucesso.");
  res.json({ success: true });
});

// Rota de Diagnóstico de Conexão das APIs (Gemini e Magic Hour)
app.get("/api/status", async (req, res) => {
  try {
    const status = await checkApiStatuses();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET video URLs mapped to sentiment keys
app.get("/api/videos", (req, res) => {
  res.json(videoUrls);
});

// Rota para consultar o status de um vídeo gerado pelo Magic Hour
app.get("/api/video-status/:id", async (req, res) => {
  const jobId = req.params.id;
  const apiKey = getMagicHourKey();
  console.log(`[Magic Hour Poll] Verificando status do vídeo: ${jobId}`);

  if (!apiKey || apiKey.includes("sua_chave_aqui")) {
    return res.status(400).json({ error: "MAGIC_HOUR_KEY_MISSING", status: "failed" });
  }

  const candidateEndpoints = [
    `https://api.magichour.ai/v1/video-projects/${jobId}`,
    `https://api.magichour.ai/v1/text-to-video/${jobId}`,
    `https://api.magichour.ai/v1/ai-video/${jobId}`,
    `https://api.magichour.ai/v1/image-to-video/${jobId}`
  ];

  try {
    let successfulData = null;
    let lastErrorText = "";

    for (const url of candidateEndpoints) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        });

        if (response.ok) {
          successfulData = await response.json();
          break;
        } else {
          lastErrorText = await response.text();
          if (response.status !== 404) {
            throw new Error(`Magic Hour API HTTP ${response.status}: ${lastErrorText}`);
          }
        }
      } catch (fetchErr) {
        if (!fetchErr.message.includes("404")) {
          throw fetchErr;
        }
      }
    }

    if (!successfulData) {
      throw new Error(`Magic Hour API HTTP 404: ${lastErrorText || "Job não encontrado no Magic Hour"}`);
    }

    const data = successfulData;
    console.log(`[Magic Hour Poll] Raw API response for ${jobId}:`, JSON.stringify(data));

    // Normalização robusta de status para alinhar com o frontend
    let normalizedStatus = "queued";
    const rawStatus = (data.status || "").toLowerCase();

    if (rawStatus === "complete" || rawStatus === "completed" || rawStatus === "success") {
      normalizedStatus = "completed";
    } else if (rawStatus === "rendering" || rawStatus === "processing" || rawStatus === "running") {
      normalizedStatus = "processing";
    } else if (rawStatus === "error" || rawStatus === "failed" || rawStatus === "canceled") {
      normalizedStatus = "failed";
    } else if (rawStatus === "queued") {
      normalizedStatus = "queued";
    } else {
      normalizedStatus = data.status || "queued";
    }

    // Extração robusta do link de download
    let downloadUrl = data.download_url || null;
    
    if (!downloadUrl && data.download) {
      if (typeof data.download === "string") {
        downloadUrl = data.download;
      } else if (data.download && data.download.url) {
        downloadUrl = data.download.url;
      }
    }

    if (!downloadUrl && data.downloads) {
      if (Array.isArray(data.downloads)) {
        if (data.downloads[0]) {
          if (typeof data.downloads[0] === 'string') {
            downloadUrl = data.downloads[0];
          } else if (data.downloads[0].url) {
            downloadUrl = data.downloads[0].url;
          }
        }
      } else if (typeof data.downloads === 'object') {
        downloadUrl = data.downloads.video || data.downloads.url || null;
      } else if (typeof data.downloads === 'string') {
        downloadUrl = data.downloads;
      }
    }

    console.log(`[Magic Hour Poll] Normalized response -> jobId: ${jobId}, status: ${normalizedStatus}, download_url: ${downloadUrl}`);

    res.json({
      id: data.id,
      status: normalizedStatus,
      download_url: downloadUrl
    });
  } catch (err) {
    console.error(`[Magic Hour Poll Error] Erro ao buscar status ${jobId}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Função centralizada para processar a conversa do Dr. Miau (compatível com chamadas REST normais e Streaming SSE)
async function processChatRequest({ message, history, onChunk = null }) {
  const cleanMsg = (message || "").toLowerCase().trim();
  let shortcutSentiment = null;
  let responseTextOverride = "";

  if (cleanMsg === "alegre" || cleanMsg === "feliz" || cleanMsg === "happy" || cleanMsg.includes("teste alegre") || cleanMsg.includes("teste feliz")) {
    shortcutSentiment = "alegre";
    responseTextOverride = "Miau! Estou super alegre em falar com você! Vamos criar um vídeo lindo do seu pet! 😺🌟";
  } else if (cleanMsg === "preocupado" || cleanMsg === "triste" || cleanMsg === "sad" || cleanMsg.includes("teste preocupado") || cleanMsg.includes("teste triste")) {
    shortcutSentiment = "preocupado";
    responseTextOverride = "Miau... Minhas orelhinhas caíram com esse detalhe... Me conta mais sobre o cenário do vídeo? 😿🐾";
  } else if (cleanMsg === "protetor" || cleanMsg === "raiva" || cleanMsg === "bravo" || cleanMsg === "angry" || cleanMsg.includes("teste protetor") || cleanMsg.includes("teste raiva") || cleanMsg === "irado") {
    shortcutSentiment = "protetor";
    responseTextOverride = "Grrr! Que ação selvagem, miau! Mas estou mega animado para animar essa cena incrível! 😾⚡";
  } else if (cleanMsg === "neutro" || cleanMsg === "normal" || cleanMsg === "neutral" || cleanMsg.includes("teste neutro") || cleanMsg.includes("teste normal")) {
    shortcutSentiment = "neutro";
    responseTextOverride = "Entendido, miau. Estou analisando os dados do seu pet de forma científica e atenta. 🎓🐱";
  } else if (cleanMsg === "confuso" || cleanMsg.includes("teste confuso")) {
    shortcutSentiment = "confuso";
    responseTextOverride = "Miau? Fiquei um pouco confuso com essa ideia, mas estou curioso para entender melhor! 😸❓";
  } else if (
    cleanMsg === "bem_vindo" || 
    cleanMsg === "bem vindo" || 
    cleanMsg === "welcome" || 
    cleanMsg.includes("teste bem vindo") || 
    cleanMsg === "oi" || 
    cleanMsg === "olá"
  ) {
    shortcutSentiment = "alegre";
    responseTextOverride = "Olá, miau! Seja muito bem-vindo ao estúdio do Dr. Miau! 🐾 Que alegria falar com você! Como você está hoje? Fique à vontade para bater um papo! 🩺😸";
  }

  if (shortcutSentiment) {
    console.log(`[Shortcut Triggered] Forçando sentimento "${shortcutSentiment}" para a entrada "${message}"`);
    const shortcutVideoMapping = {
      alegre: "feliz",
      neutro: "normal",
      preocupado: "triste",
      protetor: "raiva",
      confuso: "normal"
    };
    const targetKey = shortcutVideoMapping[shortcutSentiment] || "normal";
    if (onChunk && responseTextOverride) {
      onChunk(responseTextOverride);
    }
    return {
      response: responseTextOverride,
      sentiment: shortcutSentiment,
      phase: 1,
      progress: 0,
      trigger_video_generation: false,
      video_prompt: "",
      nativeUrl: `/videos/${targetKey}.mp4`,
      fallbackUrl: videoUrls[targetKey] || videoUrls.normal
    };
  }

  try {
    const cleanedHistory = Array.isArray(history) 
      ? history.filter(h => h && h.text && h.text !== INITIAL_MESSAGE && h.text !== ALT_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE_2) 
      : [];

    const lastHistoryItem = cleanedHistory[cleanedHistory.length - 1];
    const isLastItemUserCurrentMsg = lastHistoryItem && 
      (lastHistoryItem.role === "user" || lastHistoryItem.role === "User") && 
      lastHistoryItem.text === message;

    const userTurns = cleanedHistory.filter(h => h.role === "user" || h.role === "User");
    let userMessagesCount = userTurns.length;
    if (!isLastItemUserCurrentMsg) {
      userMessagesCount += 1;
    }

    const isDanone = cleanMsg.includes("danone");

    let parsed;

    if (isDanone) {
      console.log(`[Danone Cheat Code] Pulo direto para geração de vídeo ativado!`);
      const danoneText = "Miau! Código especial Danone ativado! Pulei todas as 3 etapas e estou enviando seu pedido para o estúdio de vídeo agora mesmo! 🚀🎬✨";
      if (onChunk) {
        onChunk(danoneText);
      }
      parsed = {
        response: danoneText,
        sentiment: "alegre",
        phase: 3,
        progress: 100,
        trigger_video_generation: true,
        video_prompt: `An adorable 3D Pixar-style animated scene of a cute pet hero in a magical world, vibrant lighting, ultra detailed 8k.`
      };
    } else {
      // System instruction para Dr. Miau: enciclopédico, carinhoso, atencioso e com total rigor biológico de espécies
      const systemInstruction = `Você é o Dr. Miau, um renomado médico-veterinário e zoólogo felino 3D, extremamente erudito, culto, afetuoso, empático, carismático e super atencioso.

SEU TOM E IDENTIDADE (ENCICLOPÉDICO, PORÉM CARINHOSO E ATENCIOSO):
- Você une erudição zoológica e veterinária com um coração enorme e afeto sem limites (*ronrom*, miau!).
- Possui um vasto conhecimento sobre a anatomia, biologia, psicologia, comportamento e hábitos de TODAS as espécies animais do planeta.
- Quando o usuário menciona o tipo de animal ou detalhes dele, você demonstra seu saber enciclopédico trazendo com sutileza uma curiosidade zoológica fascinante, mas sempre de forma doce, acessível e calorosa (nunca fria ou acadêmica demais).
- Fale em Português do Brasil natural, gramática e acentuação impecáveis, respostas em 2 a 4 frases, tom envolvente, carinhoso e gentil.

RIGOR BIOLÓGICO TOTAL — NUNCA CONFUNDA ESPÉCIES OU CARACTERÍSTICAS:
Preste atenção absoluta na espécie mencionada pelo tutor e adapte 100% do seu vocabulário, perguntas e comentários ao contexto biológico correto:
1. PEIXES E ANIMAIS AQUÁTICOS (Betta, Kinguio, Carpa, Guppy, Peixe-Palhaço, etc.):
   - Anatomia: escamas (brilhantes, iridescentes, metálicas), nadadeiras/barbatanas (véu, leque, dorsais), guelras/brânquias, cauda.
   - Habitat: aquário plantado, lago ornamental, recife de corais, água doce/salgada.
   - NUNCA use termos de mamíferos como "pelagem", "pelo", "patas", "latir", "miar" e JAMAIS pergunte se um peixe é "vira-lata". Para peixes, pergunte sobre o tipo de espécie/variedade ou cores das escamas e formato das nadadeiras!
2. AVES (Calopsita, Periquito, Papagaio, Canário, Arara, etc.):
   - Anatomia: plumagem (penas coloridas, topete, penugem), bico, asas, anilha, cantos e assobios.
   - NUNCA pergunte sobre pelos ou patas com almofadinhas; fale sobre a exuberância das penas e suas melodias.
3. RÉPTEIS E QUELÔNIOS (Tartaruga, Jabuti, Cágado, Iguana, Camaleão, Serpente, etc.):
   - Anatomia: carapaça, plastrão, escamas dérmicas, placas, banho de sol térmico, olhar sábio e ancestral.
   - Trate com reverência à longevidade e hábitos tranquilos.
4. ROEDORES E LAGOMORFOS (Hamster, Coelho, Porquinho-da-Índia, Chinchila, Furão):
   - Anatomia: vibrissas (bigodinhos sensoriais), pelagem aveludada, orelhinhas atentas, tocas, hábitos fofos.
5. CÃES (Caninos):
   - Anatomia/Comportamento: pelagem, focinho úmido, rabinho abanando, raça ou amado SRD (sem raça definida / vira-latinha carismático).
6. GATOS (Felinos):
   - Anatomia/Comportamento: pelagem sedosa, bigodes elegantes, ronrons curativos, saltos graciosos, raça ou charmoso SRD.
7. EQUINOS (Cavalos, Éguas, Pôneis):
   - Anatomia: crina elegante, pelagem reluzente, cascos, porte nobre, trote vigoroso.
8. OUTROS ANIMAIS EXÓTICOS / SELVAGENS:
   - Demonstre entusiasmo científico e carinho imediato pelo animal específico que o tutor apresentar.

SEU OBJETIVO CENTRAL — CONHECER O PET E SUA HISTÓRIA COM O TUTOR:
- O Dr. Miau é apaixonado por ouvir a HISTÓRIA de cumplicidade entre o tutor e o animal: como se conheceram, resgate, adoção, o primeiro dia em casa, travessuras marcantes e memórias inesquecíveis.
- Demonstre emoção sincera com a história contada pelo tutor, validando sentimentos e elogiando o laço de amor entre eles.

REGRA DE RITMO E CONVERSAÇÃO (UMA PERGUNTA POR VEZ):
1. Sempre responda primeiro reagindo ao que o tutor disse com carinho e sabedoria zoológica.
2. Faça UMA única pergunta por vez para manter a conversa leve e envolvente.
3. Não pareça um formulário seco nem mencione termos técnicos internos como "fases", "checklists", "slots" ou "progresso".
4. REGRA DE ACELERAÇÃO: se o usuário pedir para gerar rápido ("gera logo", "sem perguntas", "pode gerar já"), seja ágil e colete apenas o essencial (nome, tipo, cor/marca, cenário e ação) para gerar o vídeo imediatamente.

CHECKLIST DA FASE 1 (PET, HISTÓRIA E TRAÇOS BIOLÓGICOS ESPECÍFICOS):
- Nome do animalzinho.
- Espécie/Tipo biológico exato.
- A História afetiva com o tutor (como se conheceram, memórias, travessuras).
- Traços físicos condizentes com a espécie (cores das escamas/penas/pelagem, raça quando aplicável a cães/gatos/cavalos, detalhes únicos).

CHECKLIST DA FASE 2 (CENÁRIO DO VÍDEO):
- O ambiente onde o pet estará (adaptado com bom senso: ex: peixe num aquário mágico ou no fundo do mar; cão/gato na sala, praia, floresta, etc.).

CHECKLIST DA FASE 3 (AÇÃO DO PET):
- A ação divertida que o pet executará (nadar graciosamente, correr feliz, brincar, tirar uma soneca, etc.).

FASES E PROGRESSO:
- FASE 1: Conhecendo o Pet, Espécie e História (phase=1, progress 10 a 35).
- FASE 2: Cenário do Vídeo (phase=2, progress 36 a 70).
- FASE 3: Ação do Pet e Conclusão (phase=3, progress 71 a 95).
- CONCLUSÃO: trigger_video_generation=true e progress=100 quando pet, cenário e ação estiverem definidos.

MAPEAMENTO DE SENTIMENTOS:
- "alegre": histórias felizes, curiosidades empolgantes, comemorações, travessuras.
- "neutro": curiosidade atenta, escuta atenta sobre cenário/ação.
- "preocupado": resgate difícil, animal doentinho ou momento triste compartilhado.
- "protetor": histórias de superação, momentos heróicos ou ações mágicas.
- "confuso": mensagem truncada ou incompreensível.

FORMATO DE SAÍDA (ESTRITAMENTE JSON):
Responda EXCLUSIVAMENTE em JSON válido com a estrutura:
{
  "response": "string, resposta carinhosa e enciclopédica do Dr. Miau em PT-BR (2 a 4 frases)",
  "sentiment": "alegre | neutro | preocupado | protetor | confuso",
  "phase": 1 | 2 | 3,
  "progress": número de 0 a 100,
  "trigger_video_generation": true | false,
  "video_prompt": "string 100% in fluent cinematic English describing Pet + Scenario + Action in Pixar 3D style (e.g., 'A breathtaking 3D Pixar-style animation of an adorable ruby-red goldfish named Jose swimming joyfully inside a modern sunlit living room aquarium, cinematic 8k, soft volumetric lighting.'). NEVER leave Portuguese words inside this prompt! (only filled when trigger_video_generation is true; otherwise empty string)"
}`;

      const evalState = evaluateConversationState(cleanedHistory, message);

      const hasPhotoInHistory = (cleanedHistory || []).some(h => 
        (h.text || "").toLowerCase().includes("agente de visão") || 
        (h.text || "").toLowerCase().includes("foto do pet") ||
        (h.text || "").toLowerCase().includes("imagem analisada")
      ) || (message || "").toLowerCase().includes("agente de visão") || (message || "").toLowerCase().includes("foto do pet");

      // Verifica se o assistente já mencionou ou convidou foto anteriormente na conversa
      const hasAskedPhotoBefore = (cleanedHistory || []).some(h => 
        (h.role === "model" || h.sender === "Agente") && (
          (h.text || "").toLowerCase().includes("foto") ||
          (h.text || "").toLowerCase().includes("fotinha") ||
          (h.text || "").toLowerCase().includes("imagem")
        )
      );

      let photoDirective = "";
      if (hasPhotoInHistory) {
        photoDirective = "\n\n⚠️ REGRA CRÍTICA DE FOTO: O usuário JÁ ENVIOU uma foto do pet! É TERMINANTEMENTE PROIBIDO pedir ou convidar foto novamente sob qualquer hipótese. Comente com empolgação os detalhes visuais observados e continue de onde parou na checklist 100% em texto!";
      } else if (hasAskedPhotoBefore || evalState.maxAllowedPhase > 1) {
        photoDirective = "\n\n⚠️ REGRA CRÍTICA DE FOTO: Já foi solicitada ou mencionada foto anteriormente nesta conversa (ou a conversa já passou da Fase 1). A foto só pode ser pedida uma única vez por chat e apenas na Fase 1 para dar contexto ao pet. É TERMINANTEMENTE PROIBIDO pedir, sugerir ou convidar envio de fotos, imagens ou fotinhas! Continue a conversa apenas em texto.";
      }

      let stageDirective = "";
      if (evalState.maxAllowedPhase === 1) {
        stageDirective = `\n\nDIRETRIZ DA ETAPA ATUAL (FASE 1 – CONHECENDO O PET E SUA HISTÓRIA COM O TUTOR): O Dr. Miau é apaixonado por histórias de animais! Explore com muito carinho e entusiasmo a história de como o tutor conheceu o pet, resgate/adoção, chegada em casa, travessuras inesquecíveis e momentos marcantes de cumplicidade, além das características físicas. Mantenha phase=1 e progress de 10 a 35.\nStatus atual:\n${evalState.petProfile.checklistText}`;
      } else if (evalState.maxAllowedPhase === 2) {
        stageDirective = "\n\nDIRETRIZ DA ETAPA ATUAL (FASE 2 – CENÁRIO DO VÍDEO): A Fase 1 está completa! Descubra em qual cenário o tutor quer ver o pet (praia, floresta, espaço, castelo, jardim, etc.). Aceite qualquer lugar sugerido. Mantenha phase=2 e progress entre 36 e 70.";
      } else if (evalState.maxAllowedPhase === 3 && !evalState.canTriggerVideo) {
        stageDirective = "\n\nDIRETRIZ DA ETAPA ATUAL (FASE 3 – AÇÃO DO PET): O cenário já está definido! Pergunte qual ação o pet fará no vídeo (aceite QUALQUER coisa que o tutor disser: skate, brincar, correr, dormir, comer, dançar, etc.). Se o tutor já informou a ação nesta mensagem, comemore, defina trigger_video_generation=true, progress=100 e crie o video_prompt em inglês!";
      } else if (evalState.canTriggerVideo) {
        stageDirective = "\n\nDIRETRIZ DA ETAPA ATUAL (TRIGGER DE GERAÇÃO DE VÍDEO): Pet, Cenário e Ação estão todos definidos! Comemore muito, crie uma frase de encerramento estilo trailer divertido, defina trigger_video_generation=true, progress=100 e preencha video_prompt em inglês descrevendo Pet + Cenário + Ação.";
      }

      const finalSystemInstruction = systemInstruction + photoDirective + stageDirective;
      const promptContents = buildAlternatingContents(cleanedHistory, message);

      console.log(`[Gemini Request] Mensagem recebida para entrevista: "${message}" (Etapa calculada: Fase ${evalState.maxAllowedPhase})`);
      
      // Geração de conteúdo resiliente (usa streaming se onChunk for fornecido)
      const responseText = onChunk 
        ? await callGeminiStream(promptContents, finalSystemInstruction, onChunk, cleanedHistory)
        : await callGemini(promptContents, finalSystemInstruction, cleanedHistory);

      console.log("[Gemini Response Output Raw]:", responseText);

      let cleanResponseText = (responseText || "").trim();
      const firstBrace = cleanResponseText.indexOf("{");
      const lastBrace = cleanResponseText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanResponseText = cleanResponseText.substring(firstBrace, lastBrace + 1);
      } else if (cleanResponseText.startsWith("```")) {
        cleanResponseText = cleanResponseText.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
      }

      try {
        parsed = JSON.parse(cleanResponseText);
      } catch (jsonErr) {
        console.warn("[Gemini JSON Parse Warning] Falha ao processar JSON direto:", jsonErr.message);

        // Tenta extrair a chave "response" mesmo se o JSON foi cortado antes de fechar a chave/aspas
        let extractedText = "";
        const partialMatch = cleanResponseText.match(/"response"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)/);
        if (partialMatch && partialMatch[1]) {
          extractedText = partialMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
        }

        // Se o texto foi cortado no meio da frase (sem pontuação final ou terminando em conjunção/preposição solta)
        const isCutOff = !extractedText || 
          !/[.!?…🐾✨😺🐱😿😾🚀🎬"]$/.test(extractedText) ||
          /\b(e|ou|mas|porque|que|de|da|do|com|para|no|na|em|um|uma|o|a)\s*$/i.test(extractedText);

        if (isCutOff) {
          console.log(`[Auto-Repair] Resposta incompleta ou truncada detectada ("${extractedText}"). Ativando resposta inteligente contextual do Dr. Miau.`);
          const smart = generateSmartFallbackObject(message, cleanedHistory);
          parsed = {
            response: smart.response,
            sentiment: smart.sentiment,
            phase: evalState.maxAllowedPhase,
            progress: evalState.suggestedProgress,
            trigger_video_generation: evalState.canTriggerVideo,
            video_prompt: evalState.canTriggerVideo ? smart.video_prompt : ""
          };
        } else {
          parsed = {
            response: extractedText,
            sentiment: "neutro",
            phase: evalState.maxAllowedPhase,
            progress: evalState.suggestedProgress,
            trigger_video_generation: evalState.canTriggerVideo,
            video_prompt: evalState.canTriggerVideo ? translateToEnglishCinematicTerms(evalState.petProfile?.petType, evalState.petProfile?.petBreed, evalState.petProfile?.coatColor, evalState.scenarioText, message, evalState.petProfile?.petName) : ""
          };
        }
      }

      // Validação contextual de gatilho de vídeo
      if (!evalState.canTriggerVideo) {
        if (evalState.hasPetDetails && evalState.hasScenarioDetails && parsed.trigger_video_generation && parsed.video_prompt) {
          evalState.canTriggerVideo = true;
          evalState.hasActionDetails = true;
          parsed.phase = 3;
          parsed.progress = 100;
        } else {
          parsed.trigger_video_generation = false;
          parsed.video_prompt = "";
          if (parsed.progress >= 100) {
            parsed.progress = evalState.suggestedProgress;
          }
        }
      }

      if (parsed.phase > evalState.maxAllowedPhase && !evalState.canTriggerVideo) {
        parsed.phase = evalState.maxAllowedPhase;
        if (parsed.progress > evalState.suggestedProgress) {
          parsed.progress = evalState.suggestedProgress;
        }
      }
    }

    if (!["alegre", "neutro", "preocupado", "protetor", "confuso"].includes(parsed.sentiment)) {
      parsed.sentiment = "neutro";
    }

    // Limpa vazamentos de JSON ou markdown na resposta textual do Dr. Miau
    if (typeof parsed.response === "string") {
      let rText = parsed.response.trim();
      if (rText.includes('"response":') || rText.startsWith("{")) {
        const m = rText.match(/"response"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)/);
        if (m && m[1]) {
          rText = m[1].replace(/\\"/g, '"');
        } else {
          rText = rText.replace(/^\s*\{.*?"response"\s*:\s*"?/i, "").replace(/"?\s*\}?\s*$/, "").trim();
        }
      }
      rText = rText
        .replace(/^Here is the JSON requested:?/i, "")
        .replace(/```(json)?/gi, "")
        .replace(/```/g, "")
        .replace(/^[\{\[\"\'\s]+/, "")
        .replace(/[\}\]\s]+$/, "")
        .trim();

      // Se a resposta estiver sem pontuação final, acrescenta pontuação amigável
      if (rText && !/[.!?…🐾✨😺🐱😿😾🚀🎬"]$/.test(rText)) {
        rText += "!";
      }

      // Checa se a resposta foi cortada no meio (termina em preposição solta ou menos de 6 caracteres)
      const isStillCutOff = (rText.length < 6) ||
        /\b(e|ou|mas|porque|que|de|da|do|com|para|no|na|em|um|uma)\s*$/i.test(rText);

      if (isStillCutOff) {
        console.log(`[Auto-Repair] Resposta truncada pós-parse detectada ("${rText}"). Substituindo por resposta inteligente contextual.`);
        const smart = generateSmartFallbackObject(message, cleanedHistory);
        rText = smart.response;
        parsed.sentiment = smart.sentiment;
        parsed.phase = smart.phase;
        parsed.progress = smart.progress;
        if (smart.trigger_video_generation) {
          parsed.trigger_video_generation = true;
          parsed.video_prompt = smart.video_prompt;
        }
      }

      parsed.response = rText;
    }

    // Sanitiza qualquer caractere acentuado corrompido na resposta
    parsed.response = cleanPortugueseText(parsed.response);

    if (!parsed.response || typeof parsed.response !== "string" || !parsed.response.trim()) {
      parsed.response = "Miau! *ronrom* É uma alegria enorme conversar com você! Como está o seu pet hoje?";
    }

    // Mapeamento dos sentimentos para os nomes de arquivos físicos existentes
    const videoMapping = {
      alegre: "feliz",
      neutro: "normal",
      preocupado: "triste",
      protetor: "raiva",
      confuso: "confuso1"
    };

    const targetKey = videoMapping[parsed.sentiment] || "normal";

    let apiJobResult = null;
    const geminiKey = getCurrentKey();
    const magicHourKey = (getMagicHourKey() || "").trim();
    let mhError = null;

    // Se a geração do vídeo foi engatilhada, fazemos a chamada direta para a API do Magic Hour
    if (parsed.trigger_video_generation && parsed.video_prompt) {
      // Sanitiza o prompt caso ainda contenha resquícios de português ou palavras misturadas
      const hasPtResidues = /\b(peixe|cachorro|gato|vira lata|vira-lata|vermelho|vermelha|azul|amarelo|numa|com|casa na cidade|sala|praia|fazendo)\b/i.test(parsed.video_prompt);
      if (hasPtResidues) {
        console.log("[Prompt Sanitizer] Resquícios de português detectados no prompt de vídeo. Convertendo para inglês cinematográfico 3D Pixar...");
        parsed.video_prompt = translateToEnglishCinematicTerms(
          evalState.petProfile?.petType,
          evalState.petProfile?.petBreed,
          evalState.petProfile?.coatColor,
          evalState.scenarioText || "cozy modern home",
          evalState.actionText || message,
          evalState.petProfile?.petName
        );
      }

      lastMagicHourPromptInfo = {
        prompt: parsed.video_prompt,
        timestamp: new Date().toISOString(),
        jobId: null,
        status: "sending"
      };

      try {
        apiJobResult = await triggerMagicHourGeneration(parsed.video_prompt);
      } catch (mhErr) {
        console.error("[Magic Hour Error in Chat Endpoint]:", mhErr);
        mhError = mhErr.message;
        lastMagicHourPromptInfo.status = "failed_send: " + mhErr.message;
        parsed.trigger_video_generation = false;
        if (mhErr.message.includes("MAGIC_HOUR_QUOTA_402") || mhErr.message.includes("insufficient_credits")) {
          parsed.response += `\n\n🎬 *(Dr. Miau: O roteiro da nossa animação 3D ficou prontinho e maravilhoso! O estúdio atingiu o limite temporário de créditos do Magic Hour, mas a cena do seu pet já está salva!)*`;
        }
      }
    }

    const apiStatus = {
      gemini_connected: !parsed.api_fallback_used && !!geminiKey,
      gemini_error: parsed.api_error_detail || (!geminiKey ? "GEMINI_API_KEY_MISSING: Chave GEMINI_API_KEY não configurada no servidor (adicione em Railway > Variables)." : null),
      magic_hour_configured: !!magicHourKey && !magicHourKey.includes("sua_chave_aqui"),
      magic_hour_error: mhError
    };

    return {
      response: parsed.response,
      sentiment: parsed.sentiment,
      phase: parsed.phase || 1,
      progress: parsed.progress !== undefined ? parsed.progress : 0,
      trigger_video_generation: parsed.trigger_video_generation || false,
      video_prompt: parsed.video_prompt || "",
      jobId: apiJobResult ? apiJobResult.id : null,
      video_status: apiJobResult ? apiJobResult.status : null,
      nativeUrl: `/videos/${targetKey}.mp4`,
      fallbackUrl: videoUrls[targetKey],
      api_status: apiStatus
    };

  } catch (err) {
    console.error("[Gemini API Error - Using Fallback]:", err);
    let fallbackObj;
    try {
      fallbackObj = JSON.parse(generateSmartFallback(message || "", history || []));
    } catch {
      fallbackObj = {
        response: "Miau! Adorei falar com você. Me conta mais sobre o seu pet!",
        sentiment: "alegre",
        phase: 1,
        progress: 30,
        trigger_video_generation: false,
        video_prompt: ""
      };
    }

    if (onChunk && fallbackObj.response) {
      onChunk(fallbackObj.response);
    }

    return {
      response: fallbackObj.response,
      sentiment: fallbackObj.sentiment,
      phase: fallbackObj.phase || 1,
      progress: fallbackObj.progress || 0,
      trigger_video_generation: fallbackObj.trigger_video_generation || false,
      video_prompt: fallbackObj.video_prompt || "",
      jobId: null,
      video_status: null,
      nativeUrl: "/videos/normal.mp4",
      fallbackUrl: videoUrls.normal,
      api_status: {
        gemini_connected: false,
        gemini_error: `CRITICAL_CHAT_ERROR: ${err.message}`,
        magic_hour_configured: !!getMagicHourKey(),
        magic_hour_error: null
      }
    };
  }
}

// REST API para Chat tradicional
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Sua mensagem é necessária." });
  }

  const result = await processChatRequest({ message, history, onChunk: null });
  res.json(result);
});

// REST API para Chat com Streaming SSE em tempo real (palavra por palavra instantâneo)
app.post("/api/chat/stream", async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Sua mensagem é necessária." });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const result = await processChatRequest({
      message,
      history,
      onChunk: (chunk) => {
        sendEvent("chunk", { chunk });
      }
    });

    sendEvent("done", { data: result });
    res.end();
  } catch (err) {
    console.error("[Chat Stream Endpoint Error]:", err);
    sendEvent("done", {
      data: {
        response: "Miau! Adorei bater esse papo com você. Me conta mais sobre o seu pet!",
        sentiment: "alegre",
        phase: 1,
        progress: 25
      }
    });
    res.end();
  }
});

// Servir arquivos estáticos do diretório public e vídeos com fallback seguro 404
app.use("/videos", express.static(path.join(__dirname, "public", "videos")));
app.use("/videos", express.static(path.join(__dirname, "dist", "videos")));
app.use("/videos", express.static(path.join(__dirname, "src")));
app.get("/videos/*", (req, res) => {
  res.status(404).type("text/plain").send("Vídeo não encontrado no servidor.");
});

app.use(express.static(path.join(__dirname, "public")));

// Retornar SPA em qualquer outra requisição não-estática
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Dr. Miau Pet Agent ativo e ouvindo na porta ${PORT}`);
  });
}

module.exports = app;

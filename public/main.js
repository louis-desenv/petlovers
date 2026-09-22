// ════════════════════════════════════════════════════════════════════════════
//  Pet Agent — Dr. Miau  |  main.js
//  API: Magic Hour (image-to-video)
//  Sem nenhuma dependência do Simli
// ════════════════════════════════════════════════════════════════════════════

// ─── Configuração Dr. Miau ──────────────────────────────────────────────────
const DR_MIAU_IMAGE_PATH = "./dr-miau.png";

// ─── Seletores ────────────────────────────────────────────────────────────────
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ─── Mensagem inicial ─────────────────────────────────────────────────────────
const INITIAL_MESSAGE =
  "Olá! Sou o Dr. Miau! 🐾 É um prazer imenso estar aqui com você! Fique à vontade para bater um papo, contar como foi seu dia ou me fazer qualquer pergunta!";

// ─── Pool de Animações com Chance (%) ─────────────────────────────────────────
const ANIMATION_POOL = {
  normal: [
    { url: "/videos/normal.mp4", probability: 25, label: "Normal (Padrão)" },
    { url: "/videos/normal1.mp4", probability: 25, label: "Normal (Var 1)" },
    { url: "/videos/normal2.mp4", probability: 25, label: "Normal (Var 2)" },
    { url: "/videos/normal3.mp4", probability: 25, label: "Normal (Var 3)" }
  ],
  feliz: [
    { url: "/videos/feliz.mp4", probability: 34, label: "Feliz (Padrão)" },
    { url: "/videos/feliz1.mp4", probability: 33, label: "Feliz (Var 1)" },
    { url: "/videos/feliz2.mp4", probability: 33, label: "Feliz (Var 2)" }
  ],
  bem_vindo: [
    { url: "/videos/bem_vindo.mp4", probability: 25, label: "Bem-vindo (Padrão)" },
    { url: "/videos/bemvindo1.mp4", probability: 25, label: "Bem-vindo (Var 1)" },
    { url: "/videos/bemvindo2.mp4", probability: 25, label: "Bem-vindo (Var 2)" },
    { url: "/videos/bemvindo3.mp4", probability: 25, label: "Bem-vindo (Var 3)" }
  ],
  triste: [
    { url: "/videos/triste.mp4", probability: 34, label: "Triste (Padrão)" },
    { url: "/videos/triste1.mp4", probability: 33, label: "Triste (Var 1)" },
    { url: "/videos/triste2.mp4", probability: 33, label: "Triste (Var 2)" }
  ],
  raiva: [
    { url: "/videos/raiva.mp4", probability: 50, label: "Raiva (Padrão)" },
    { url: "/videos/raiva1.mp4", probability: 50, label: "Raiva (Var 1)" }
  ],
  confuso: [
    { url: "/videos/confuso1.mp4", probability: 100, label: "Confuso (Var 1)" }
  ],
  esperando: [
    { url: "/videos/esperandoresposta.mp4", probability: 100, label: "Esperando Resposta" }
  ]
};

function getRandomVideoForEmotion(emotion) {
  const pool = ANIMATION_POOL[emotion] || ANIMATION_POOL["normal"];
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const item of pool) {
    cumulative += item.probability;
    if (rand <= cumulative) {
      console.log(`[Animation Pool] Selecionado para ${emotion}: "${item.label}" (${item.probability}%)`);
      return item.url;
    }
  }
  return pool[pool.length - 1].url;
}

// ─── Estado global ────────────────────────────────────────────────────────────
const state = {
  mode:         "text",   // "text" | "audio"
  listening:    false,
  activeRecognition: null, // Referência para SpeechRecognition ativo
  historyOpen:  false,
  helpOpen:     false,
  profileOpen:  false,
  miniHistoryVisible: true, // Se o mini-histórico está visível
  activeHistoryTab: "messages", // "messages" | "videos"
  progress:     0,
  currentPhase: 1,        // Parte 1 (Animal), Parte 2 (Cenário), Parte 3 (Ação/Vídeo)
  photoRequested: false,  // Se o Dr. Miau solicitou uma foto na fase atual
  selectedImageBase64: null, // Imagem em base64 pendente de envio
  selectedImageMime: "image/jpeg",
  animating:    false,    // job Magic Hour em andamento
  currentJobId: null,
  generating:   false,    // Gemini a gerar resposta
  animationCache: [],     // cache de URLs de animações geradas
  idleAnimationUrl: null, // URL da animação de ociosidade
  videoPlayCount: 1,      // contador de repetições da animação atual
  currentEmotionalVideo: "/videos/bem_vindo.mp4",
  alternationStep: 0,
  alternationPlayCount: 1,
  activeVideo: null,
  inactiveVideo: null,
  agent: {
    speaking: false,
    lastFull: INITIAL_MESSAGE,
  },
  lastGeneratedPrompt: null, // { prompt, timestamp, jobId, status }
  lastUserSubmission: null,  // { text, imageBase64, imageMime }
  messages: [
    { id: uid(), role: "Agente", text: INITIAL_MESSAGE, ts: Date.now() },
  ],
};

// ─── Funções de Cache e Persistência do Chat ─────────────────────────────────
function saveStateToCache() {
  try {
    const dataToSave = {
      messages: state.messages,
      progress: state.progress,
      currentPhase: state.currentPhase,
      photoRequested: state.photoRequested,
      lastGeneratedPrompt: state.lastGeneratedPrompt,
      lastUserSubmission: state.lastUserSubmission
    };
    localStorage.setItem("drMiau_chatState", JSON.stringify(dataToSave));
  } catch (e) {
    console.warn("Não foi possível salvar o estado da conversa em cache:", e);
  }
}

function loadStateFromCache() {
  try {
    const saved = localStorage.getItem("drMiau_chatState");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        state.messages = parsed.messages;
      }
      if (typeof parsed.progress === "number") state.progress = parsed.progress;
      if (typeof parsed.currentPhase === "number") state.currentPhase = parsed.currentPhase;
      if (typeof parsed.photoRequested === "boolean") state.photoRequested = parsed.photoRequested;
      if (parsed.lastGeneratedPrompt) state.lastGeneratedPrompt = parsed.lastGeneratedPrompt;
      if (parsed.lastUserSubmission) state.lastUserSubmission = parsed.lastUserSubmission;
    }
  } catch (e) {
    console.warn("Não foi possível carregar o cache da conversa:", e);
  }
}

function resetChat() {
  try { localStorage.removeItem("drMiau_chatState"); } catch {}
  state.messages = [{ id: uid(), role: "Agente", text: INITIAL_MESSAGE, ts: Date.now() }];
  state.progress = 0;
  state.currentPhase = 1;
  state.photoRequested = false;
  state.lastGeneratedPrompt = null;
  state.lastUserSubmission = null;
  state.generating = false;
  showThinking(false);
  setGenerating(false);
  clearSelectedImage();
  if (ui.messageInput) ui.messageInput.value = "";
  setDockTitle("Pronto para conversar");
  renderHistory();
  renderMiniHistory();
  setBubble(INITIAL_MESSAGE);
  setProgress(0);
  saveStateToCache();
  updateComposerState();
  renderPromptModalContent();
  updatePromptBtnState();
  playEmotionalVideo(getRandomVideoForEmotion("bem_vindo"));

  // Notifica o backend para limpar o último prompt do Magic Hour
  fetch("/api/reset-prompt", { method: "POST" }).catch(() => {});
}

// ─── Repetir Última Instrução ────────────────────────────────────────────────
async function retryLastInstruction() {
  if (state.generating) return;

  // Procura a última submissão válida de usuário
  let lastSubmission = state.lastUserSubmission;
  if (!lastSubmission || (!lastSubmission.text && !lastSubmission.imageBase64)) {
    const userMsgs = state.messages.filter(m => m.role === "Voce");
    if (userMsgs.length > 0) {
      const last = userMsgs[userMsgs.length - 1];
      lastSubmission = {
        text: last.text === "Enviou uma foto do pet 📷" ? "" : last.text,
        imageBase64: last.imageUrl || null,
        imageMime: "image/jpeg"
      };
      state.lastUserSubmission = lastSubmission;
    }
  }

  if (!lastSubmission || (!lastSubmission.text && !lastSubmission.imageBase64)) {
    setDockTitle("Nenhuma instrução anterior para repetir");
    setTimeout(() => setDockTitle("Pronto para conversar"), 2000);
    return;
  }

  // Remove a última resposta do agente se ela foi emitida após essa instrução
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && lastMsg.role === "Agente") {
    state.messages.pop();
  }

  // Feedback visual no botão de retry da barra de ferramentas
  const retryBtn = $("#retryLastBtn");
  if (retryBtn) {
    retryBtn.classList.add("is-retrying");
    setTimeout(() => retryBtn.classList.remove("is-retrying"), 1500);
  }

  renderHistory();
  renderMiniHistory();
  setDockTitle("Repetindo última instrução...");

  // Reenvia a instrução
  await agentRespond(lastSubmission.text, lastSubmission.imageBase64, lastSubmission.imageMime);
}

// ─── Alternador de Modo de Chat (Lado a Lado / Empilhado) ────────────────────
function setChatLayout(isSideBySide) {
  const exp = $(".experience");
  const toggleBtn = $("#toggleLayoutBtn");
  const toggleText = $("#toggleLayoutText");
  if (!exp) return;

  if (isSideBySide) {
    exp.classList.add("layout-side-by-side");
    document.body.classList.add("is-side-by-side");
    toggleBtn?.classList.add("is-active");
    toggleBtn?.setAttribute("aria-pressed", "true");
    toggleBtn?.setAttribute("title", "Voltar ao modo padrão empilhado");
    if (toggleText) toggleText.textContent = "Chat Padrão";
    try {
      localStorage.setItem("drMiau_chatLayout", "side-by-side");
    } catch {}

    // Se o histórico de mensagens estiver recolhido, expande para ver tudo!
    if (state.miniHistoryCollapsed) {
      setMiniHistoryCollapsed(false);
    }
  } else {
    exp.classList.remove("layout-side-by-side");
    document.body.classList.remove("is-side-by-side");
    toggleBtn?.classList.remove("is-active");
    toggleBtn?.setAttribute("aria-pressed", "false");
    toggleBtn?.setAttribute("title", "Modo Dividido: Dr. Miau na esquerda, Chat na direita");
    if (toggleText) toggleText.textContent = "Trocar Chat";
    try {
      localStorage.setItem("drMiau_chatLayout", "stacked");
    } catch {}
  }

  setTimeout(() => {
    if (ui.miniHistory) {
      ui.miniHistory.scrollTop = ui.miniHistory.scrollHeight;
    }
  }, 120);
}

function toggleChatLayout() {
  const exp = $(".experience");
  if (!exp) return;
  const isCurrentlySide = exp.classList.contains("layout-side-by-side");
  setChatLayout(!isCurrentlySide);
}

// ─── Manipulação de Anexo de Fotos e Prévia Discreta ──────────────────────────
function showPhotoPreviewTray(dataUrl) {
  const previewContainer = $("#imagePreviewContainer");
  const previewImg = $("#imagePreviewImg");
  const attachBtn = $("#imageAttachBtn");

  if (previewContainer && previewImg) {
    previewImg.src = dataUrl;
    previewContainer.classList.remove("hidden");
  }
  if (attachBtn) {
    attachBtn.classList.add("has-photo");
  }
  updateComposerState();
  ui.messageInput?.focus();
}

function handleImageSelect(file) {
  if (!file) return;
  if (!file.type || !file.type.startsWith("image/")) {
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    state.selectedImageBase64 = e.target.result;
    state.selectedImageMime = file.type || "image/jpeg";
    showPhotoPreviewTray(e.target.result);
  };
  reader.readAsDataURL(file);
}

function clearSelectedImage() {
  state.selectedImageBase64 = null;
  state.selectedImageMime = "image/jpeg";
  const previewContainer = $("#imagePreviewContainer");
  const previewImg = $("#imagePreviewImg");
  const fileInput = $("#imageFileInput");
  const attachBtn = $("#imageAttachBtn");

  if (previewContainer) {
    previewContainer.classList.add("hidden");
  }
  if (previewImg) {
    previewImg.src = "";
  }
  if (fileInput) {
    fileInput.value = "";
  }
  if (attachBtn) {
    attachBtn.classList.remove("has-photo");
  }
  updateComposerState();
}

function submitPhotoNow() {
  if (state.generating) return;
  const form = ui.composer;
  if (form) {
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  }
}

// ─── Referências de UI ────────────────────────────────────────────────────────
const ui = {
  bubbleText:            $('[data-ui="bubbleText"]'),
  agentBubble:           $(".agent-bubble"),
  dockTitle:             $('[data-ui="dockTitle"]'),
  composer:              $('[data-ui="composer"]'),
  messageInput:          $(".composer__input"),
  sendButton:            $(".composer__send"),
  progressBar:           $('[data-ui="progressBar"]'),
  historyPopover:        $('[data-ui="historyPopover"]'),
  historyList:           $('[data-ui="historyList"]'),
  helpPopover:           $('[data-ui="helpPopover"]'),
  miniHistory:           $('[data-ui="miniHistory"]'),
  mic:                   $('[data-action="toggleListening"]'),
  historyToggle:         $('[data-action="toggleHistory"]'),
  helpToggle:            $('[data-action="toggleHelp"]'),
  voiceLabel:            $('[data-ui="voiceLabel"]'),
  modeTabs:              $$('[data-action="setMode"]'),
  agentWrap:             $('[data-ui="agentWrap"]'),
  drMiauImg:             $("#dr-miau-img"),
  drMiauVideoA:          $("#magic-hour-video-a"),
  drMiauVideoB:          $("#magic-hour-video-b"),
  thinkingIndicator:     $("#thinkingIndicator"),
  miniHistoryToggleText: $("#mini-history-btn-text"),
};

// ════════════════════════════════════════════════════════════════════════════
//  Utilitários
// ════════════════════════════════════════════════════════════════════════════
function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function setBubble(text)     { if (ui.bubbleText) ui.bubbleText.textContent = cleanPortugueseText(text); }
function setDockTitle(text)  { if (ui.dockTitle)  ui.dockTitle.textContent  = text; }
function setVoiceLabel(text) { if (ui.voiceLabel) ui.voiceLabel.textContent = text; }

function setSendEnabled(enabled) {
  if (!ui.sendButton) return;
  ui.sendButton.disabled = !enabled;
  ui.sendButton.setAttribute("aria-disabled", String(!enabled));
}

function updateComposerState() {
  if (state.generating) {
    setSendEnabled(false);
    return;
  }
  const value = (ui.messageInput?.value ?? "").trim();
  const hasImage = Boolean(state.selectedImageBase64);
  setSendEnabled(state.mode === "text" && (value.length > 0 || hasImage));
}

function setGenerating(loading) {
  state.generating = loading;
  
  // Toggle class no composer
  ui.composer?.classList.toggle("is-loading", loading);
  
  // Toggle spinner e send-icon
  const sendIcon = ui.sendButton?.querySelector(".send-icon");
  const spinner = ui.sendButton?.querySelector(".send-spinner");
  
  if (sendIcon && spinner) {
    sendIcon.classList.toggle("hidden", loading);
    spinner.classList.toggle("hidden", !loading);
  }
  
  // Mantém o input sempre ativo e o cursor piscando
  if (ui.messageInput) {
    ui.messageInput.disabled = false;
    if (loading) {
      ui.messageInput.placeholder = "Dr. Miau está pensando... pode continuar digitando!";
    } else {
      ui.messageInput.placeholder = "Fale sobre o seu pet…";
    }
    if (state.mode === "text") {
      ui.messageInput.focus();
    }
  }
  
  updateComposerState();
}

function setProgress(value) {
  const clamped = Math.max(0, Math.min(value, 100));
  state.progress = clamped;
  if (ui.progressBar) {
    ui.progressBar.style.height = `${clamped}%`;
    ui.progressBar.style.width = ""; // Limpa a propriedade width anterior para evitar conflito com layout vertical
    ui.progressBar.closest("[role='progressbar']")
      ?.setAttribute("aria-valuenow", String(Math.round(clamped)));
  }
}

function advanceProgress(amount) {
  setProgress(state.progress + amount);
}

function showThinking(show) {
  ui.thinkingIndicator?.classList.toggle("hidden", !show);
  ui.agentWrap?.classList.toggle("is-thinking", show);
}

function showSpeaking(show) {
  ui.agentWrap?.classList.toggle("is-speaking", show);
  ui.agentBubble?.classList.toggle("is-speaking", show);
  state.agent.speaking = show;
}

// ════════════════════════════════════════════════════════════════════════════
//  Histórico de mensagens
// ════════════════════════════════════════════════════════════════════════════
function pushMessage(role, text, extra = {}) {
  const cleanText = cleanPortugueseText(text);
  const msg = { id: uid(), role, text: cleanText, ts: Date.now(), ...extra };
  state.messages.push(msg);
  if (role === "Agente") {
    state.agent.lastFull = cleanText;
    setBubble(cleanText);
  }
  saveStateToCache();
  renderHistory();
  renderMiniHistory();
  return msg;
}

function renderHistory() {
  if (!ui.historyList) return;
  ui.historyList.innerHTML = "";

  const tab = state.activeHistoryTab || "messages";

  // Atualiza as abas visualmente
  $$(".history-tab").forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });

  if (tab === "messages") {
    for (const msg of state.messages.slice(-60).reverse()) {
      const side   = msg.role === "Voce" ? "me" : "agent";
      const item   = document.createElement("div");
      item.className = `item item--${side}`;
      item.setAttribute("role", "listitem");

      const dot    = document.createElement("div");
      dot.className = "item__dot";
      dot.setAttribute("aria-hidden", "true");

      const bubble = document.createElement("div");
      bubble.className = "item__bubble";

      const roleEl = document.createElement("p");
      roleEl.className = "item__role";
      roleEl.textContent = msg.role;

      const textEl = document.createElement("p");
      textEl.className = "item__text";
      textEl.textContent = msg.text;

      bubble.append(roleEl, textEl);

      // Também mostra o vídeo no histórico de mensagens se existir
      if (msg.videoUrl) {
        const video = document.createElement("video");
        video.className = "mini-item__video";
        video.src = msg.videoUrl;
        video.controls = true;
        video.playsInline = true;
        video.style.marginTop = "8px";
        bubble.append(video);
      }

      item.append(dot, bubble);
      ui.historyList.append(item);
    }
  } else if (tab === "videos") {
    const videos = state.messages.filter(m => m.videoUrl);
    if (videos.length === 0) {
      const empty = document.createElement("p");
      empty.className = "history__empty";
      empty.textContent = "Nenhum vídeo gerado ainda. Complete o questionário do Dr. Miau para ver sua obra de arte aqui!";
      ui.historyList.append(empty);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "history-video-grid";

    for (const msg of videos) {
      const card = document.createElement("div");
      card.className = "history-video-card";

      const video = document.createElement("video");
      video.src = msg.videoUrl;
      video.controls = true;
      video.playsInline = true;

      const info = document.createElement("div");
      info.className = "history-video-card__info";

      const title = document.createElement("p");
      title.className = "history-video-card__title";
      
      const formatTime = (ts) => {
        const date = new Date(ts);
        return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'})}`;
      };
      title.textContent = formatTime(msg.ts);

      const downloadBtn = document.createElement("a");
      downloadBtn.href = msg.videoUrl;
      downloadBtn.download = "dr_miau_video.mp4";
      downloadBtn.className = "history-video-card__download";
      downloadBtn.target = "_blank";
      downloadBtn.rel = "noopener noreferrer";
      downloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Baixar
      `;

      info.append(title, downloadBtn);
      card.append(video, info);
      grid.append(card);
    }
    ui.historyList.append(grid);
  }
}

function renderMiniHistory() {
  if (!ui.miniHistory) return;

  if (ui.miniHistoryToggleText) {
    ui.miniHistoryToggleText.textContent = state.miniHistoryVisible ? "Ocultar" : "Mostrar";
  }

  const activeMessages = state.messages;
  if (activeMessages.length === 0) {
    ui.miniHistory.innerHTML = "";
    ui.miniHistory.classList.add("collapsed");
    return;
  }

  ui.miniHistory.classList.toggle("collapsed", !state.miniHistoryVisible);

  ui.miniHistory.innerHTML = "";

  // Mostra as últimas 4 trocas de mensagem (até 8 mensagens)
  const lastEight = activeMessages.slice(-8);

  for (const msg of lastEight) {
    const isMe = msg.role === "Voce";
    const side = isMe ? "me" : "agent";

    const item = document.createElement("div");
    item.className = `mini-item mini-item--${side}`;

    const text = document.createElement("p");
    text.className = "mini-item__text";
    
    let cleanText = msg.text;
    if (typeof cleanText === "string" && (cleanText.includes('"response":') || cleanText.startsWith("{"))) {
      const m = cleanText.match(/"response"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)/);
      if (m && m[1]) {
        cleanText = m[1].replace(/\\"/g, '"');
      } else {
        cleanText = cleanText.replace(/^\s*\{.*?"response"\s*:\s*"?/i, "").replace(/"?\s*\}?\s*$/, "").trim();
      }
    }
    text.textContent = cleanText;

    if (isMe) {
      item.append(text);
      if (msg.imageUrl) {
        const img = document.createElement("img");
        img.src = msg.imageUrl;
        img.className = "mini-item__photo";
        img.alt = "Foto enviada pelo usuário";
        item.append(img);
      }
    } else {
      const header = document.createElement("span");
      header.className = "mini-item__header";
      header.textContent = "DR. MIAU";
      item.append(header, text);

      // Se for a última mensagem do agente, adiciona botão discreto para repetir a resposta
      if (msg === lastEight[lastEight.length - 1] && msg.text !== INITIAL_MESSAGE && !state.generating) {
        const retryAction = document.createElement("button");
        retryAction.type = "button";
        retryAction.className = "mini-item__retry-action";
        retryAction.title = "Repetir última instrução e gerar nova resposta do Dr. Miau";
        retryAction.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          Repetir resposta
        `;
        retryAction.addEventListener("click", (e) => {
          e.stopPropagation();
          retryLastInstruction();
        });
        item.append(retryAction);
      }

      // Renderiza o player de vídeo real se completado ou o status de renderização se pendente
      if (msg.videoUrl) {
        const video = document.createElement("video");
        video.className = "mini-item__video";
        video.src = msg.videoUrl;
        video.controls = true;
        video.autoplay = false;
        video.playsInline = true;
        item.append(video);
      } else if (msg.videoStatus) {
        const statusEl = document.createElement("div");
        statusEl.className = "mini-item__status";
        statusEl.style.marginTop = "8px";
        statusEl.style.fontSize = "12px";
        statusEl.style.opacity = "0.8";
        statusEl.style.fontStyle = "italic";
        
        let statusText = "🎬 Preparando renderização no estúdio";
        if (msg.videoStatus === "queued") {
          statusText = "⏳ Vídeo na fila";
        } else if (msg.videoStatus === "processing") {
          statusText = "⚙️ Desenhando frames em 3D...";
        } else if (msg.videoStatus === "failed") {
          statusText = "❌ Falha ao processar o vídeo.";
        }
        statusEl.innerHTML = `<span class="typing-dots">${statusText}<span>.</span><span>.</span><span>.</span></span>`;
        item.append(statusEl);
      }
    }

    ui.miniHistory.append(item);
  }

  // Auto-scroll suave para manter as últimas interações à vista
  setTimeout(() => {
    ui.miniHistory.scrollTop = ui.miniHistory.scrollHeight;
  }, 50);
}

function toggleMiniHistory() {
  state.miniHistoryVisible = !state.miniHistoryVisible;
  renderMiniHistory();
}

// ════════════════════════════════════════════════════════════════════════════
//  Painéis (histórico / ajuda)
// ════════════════════════════════════════════════════════════════════════════
function setHistoryOpen(open) {
  state.historyOpen = open;
  if (ui.historyPopover) ui.historyPopover.hidden = !open;
  ui.historyToggle?.setAttribute("aria-expanded", String(open));
  if (!open && state.mode === "text") {
    ui.messageInput?.focus();
  }
}

function setHelpOpen(open) {
  state.helpOpen = open;
  if (ui.helpPopover) ui.helpPopover.hidden = !open;
  ui.helpToggle?.setAttribute("aria-expanded", String(open));
  if (open) {
    $(".help__close", ui.helpPopover)?.focus?.();
  } else if (state.mode === "text") {
    ui.messageInput?.focus();
  }
}

function toggleHistory() {
  if (!state.historyOpen) setHelpOpen(false);
  setHistoryOpen(!state.historyOpen);
  if (state.historyOpen) {
    renderHistory();
    $(".history__close", ui.historyPopover)?.focus?.();
  }
}

// Ensure help popover open/close matches aria attributes
function toggleHelp() {
  if (!state.helpOpen) setHistoryOpen(false);
  setHelpOpen(!state.helpOpen);
}

function setProfileOpen(open) {
  state.profileOpen = open;
  const dropdown = $("#profileDropdown");
  if (dropdown) {
    if (open) {
      $$(".dropdown-panel").forEach(p => p.classList.add("hidden"));
      $("#panel-main")?.classList.remove("hidden");
      dropdown.classList.remove("hidden");
      
      const txtArea = $("#feedbackText");
      const sendBtn = $("#sendFeedbackBtn");
      if (txtArea) {
        txtArea.style.display = "block";
        txtArea.value = "";
      }
      if (sendBtn) sendBtn.style.display = "block";
      $("#feedbackSuccess")?.classList.add("hidden");
    } else {
      dropdown.classList.add("hidden");
    }
  }
}

function toggleProfile() {
  if (!state.profileOpen) {
    setHistoryOpen(false);
    setHelpOpen(false);
  }
  setProfileOpen(!state.profileOpen);
}

// ════════════════════════════════════════════════════════════════════════════
//  Modo texto / voz
// ════════════════════════════════════════════════════════════════════════════
function setMode(mode) {
  state.mode = mode;
  try { localStorage.setItem("petAgent.mode", mode); } catch { /* iframe sandbox */ }

  document.body.dataset.mode = mode;

  for (const btn of ui.modeTabs) {
    btn.setAttribute("aria-selected", String(btn.dataset.mode === mode));
  }

  if (ui.messageInput) ui.messageInput.disabled = (mode === "audio");

  if (mode === "audio") {
    setDockTitle("Toque no microfone para falar");
    setVoiceLabel("");
  } else {
    stopListening();
    setDockTitle("Pronto para conversar");
    ui.messageInput?.focus?.();
  }

  updateComposerState();
}

// ════════════════════════════════════════════════════════════════════════════
//  Reconhecimento de voz (Web Speech API)
// ════════════════════════════════════════════════════════════════════════════
function supportsSpeech() {
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

function stopListening() {
  state.listening = false;
  if (ui.mic) {
    ui.mic.dataset.state = "idle";
    ui.mic.setAttribute("aria-label", "Toque para falar");
  }
  setVoiceLabel("");
  if (state.activeRecognition) {
    try {
      state.activeRecognition.stop();
    } catch (e) {
      // já parado ou cancelado
    }
    state.activeRecognition = null;
  }
}

function startListening() {
  state.listening = true;
  if (ui.mic) {
    ui.mic.dataset.state = "listening";
    ui.mic.setAttribute("aria-label", "Ouvindo — toque para parar");
  }
  setVoiceLabel("");
  setDockTitle("Ouvindo...");
}

function toggleListening() {
  if (state.listening) {
    stopListening();
    if (state.mode === "audio") setDockTitle("Toque no microfone para falar");
    return;
  }

  if (state.mode !== "audio") setMode("audio");

  if (!supportsSpeech()) {
    pushMessage("Agente", "Seu navegador não suporta reconhecimento de voz. Use o modo texto.");
    setMode("text");
    return;
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Recognition();
  rec.lang = "pt-BR";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  state.activeRecognition = rec;
  startListening();

  rec.onresult = (event) => {
    const text = event?.results?.[0]?.[0]?.transcript ?? "";
    
    // Update the input field with the recognized text
    if (ui.messageInput) {
      ui.messageInput.value = text;
      updateComposerState();
    }

    if (!text.trim()) return;
    pushMessage("Voce", text);
    agentRespond(text);
  };

  rec.onerror = (event) => {
    stopListening();
    const errorType = event?.error;
    console.warn("Speech recognition error:", errorType);
    
    // Gracefully notify the user instead of displaying generic errors
    let userMsg = "";
    if (errorType === "no-speech") {
      userMsg = "Não detectei nenhuma fala. Que tal tentar novamente?";
    } else if (errorType === "audio-capture") {
      userMsg = "Falha ao capturar áudio. Verifique se o microfone está conectado e funcionando.";
    } else if (errorType === "not-allowed") {
      userMsg = "Permissão ao microfone negada. Ative as permissões nas configurações do navegador.";
    } else if (errorType === "network") {
      userMsg = "Houve uma instabilidade de rede no reconhecimento de voz. Se o erro persistir, use o modo texto.";
    } else if (errorType === "aborted") {
      userMsg = "A gravação de voz foi interrompida.";
    } else {
      userMsg = "Não consegui entender a fala no momento. Se preferir, digite no modo texto.";
    }
    
    pushMessage("Agente", userMsg);
    if (state.mode === "audio") setDockTitle("Toque no microfone para falar");
  };

  rec.onend = () => {
    // Reset the button state and title when SpeechRecognition ends
    stopListening();
    if (state.mode === "audio") setDockTitle("Toque no microfone para falar");
  };

  const watchdog = setTimeout(() => {
    if (state.listening && state.activeRecognition === rec) {
      stopListening();
    }
  }, 6500);

  try {
    rec.start();
  } catch {
    stopListening();
    pushMessage("Agente", "Falha ao iniciar o microfone. Verifique as permissões.");
    setMode("text");
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Resposta do agente (via API do Gemini integrada)
// ════════════════════════════════════════════════════════════════════════════
async function pollVideoStatus(jobId, messageId) {
  // Inicializa o status pendente no objeto da mensagem
  const msgIndex = state.messages.findIndex(m => m.id === messageId);
  if (msgIndex !== -1) {
    state.messages[msgIndex].videoStatus = "queued";
    renderMiniHistory();
  }

  let errorCount = 0;

  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/video-status/${jobId}`);
      if (!res.ok) throw new Error(`Falha HTTP ${res.status} ao consultar status do vídeo.`);
      
      const data = await res.json();
      console.log(`[Magic Hour Poll] Job ${jobId} Status: ${data.status}`);

      const idx = state.messages.findIndex(m => m.id === messageId);
      if (idx === -1) {
        clearInterval(pollInterval);
        return;
      }

      // Reset error count on successful status check
      errorCount = 0;

      const isCompleted = data.status === "completed" || data.status === "complete" || data.status === "success";
      const isFailed = data.status === "failed" || data.status === "error" || data.status === "canceled";

      if (isCompleted && data.download_url) {
        clearInterval(pollInterval);
        state.messages[idx].videoStatus = "completed";
        state.messages[idx].videoUrl = data.download_url;
        state.messages[idx].text = "✨ Miau! Seu vídeo cinematográfico foi gerado com absoluto sucesso pelo meu estúdio! Ficou fantástico! Assista agora aqui no player de vídeo: 🎬👇";
        renderMiniHistory();
        
        // Mantém o Dr. Miau como ele mesmo e exibe a animação feliz dele ao terminar o vídeo
        playEmotionalVideo(getRandomVideoForEmotion("feliz"));
        setBubble("✨ Miau! Seu vídeo cinematográfico do pet está pronto! Assista na tela abaixo!");
        
        // Abre a modal de apresentação do vídeo pronto
        openVideoModal(data.download_url);
      } else if (isFailed) {
        clearInterval(pollInterval);
        state.messages[idx].videoStatus = "failed";
        state.messages[idx].text = "😿 Miau... Houve uma instabilidade no processamento gráfico e não conseguimos renderizar esse vídeo. Vamos tentar novamente?";
        renderMiniHistory();
      } else {
        // Atualiza o progresso do status ("queued" | "processing" | "rendering")
        let currentStatus = "queued";
        if (data.status === "processing" || data.status === "rendering" || data.status === "running") {
          currentStatus = "processing";
        }
        state.messages[idx].videoStatus = currentStatus;
        renderMiniHistory();
      }
    } catch (err) {
      errorCount++;
      console.warn(`[Poll Video Warning] Tentativa ${errorCount}/6 falhou para o job ${jobId}:`, err.message);
      if (errorCount >= 6) {
        clearInterval(pollInterval);
        const idx = state.messages.findIndex(m => m.id === messageId);
        if (idx !== -1) {
          state.messages[idx].videoStatus = "failed";
          state.messages[idx].text = "😿 Miau... O serviço de vídeo demorou a responder. Mas não se preocupe, podemos tentar gerar outro vídeozinho a qualquer momento!";
          renderMiniHistory();
        }
      }
    }
  }, 4000);
}

// ════════════════════════════════════════════════════════════════════════════
//  Resposta do agente (via API do Gemini integrada)
// ════════════════════════════════════════════════════════════════════════════
async function agentRespond(userText, imageBase64 = null, imageMime = null) {
  // Salva a última instrução válida para possibilitar repeti-la a qualquer momento
  if (userText || imageBase64) {
    state.lastUserSubmission = {
      text: userText || "",
      imageBase64: imageBase64 || null,
      imageMime: imageMime || "image/jpeg"
    };
    saveStateToCache();
  }

  showThinking(true);
  playEmotionalVideo("/videos/esperandoresposta.mp4");
  setGenerating(true);
  setDockTitle("Dr. Miau está pensando...");
  showSpeaking(false);

  let fullMessageToAgent = userText;

  if (imageBase64) {
    if (ui.bubbleText) {
      ui.bubbleText.innerHTML = 'Nosso Agente de Visão está analisando a foto<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
    }
    setDockTitle("Agente de Visão analisando foto...");

    try {
      const visionRes = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageBase64,
          mimeType: imageMime || "image/jpeg",
          phase: state.currentPhase
        })
      });

      const visionData = await visionRes.json().catch(() => null);
      if (visionData && visionData.description) {
        console.log("✅ [Agente de Visão Output]:", visionData.description);
        const phaseTitle = state.currentPhase === 1 ? "Parte 1 - O Animal" : state.currentPhase === 2 ? "Parte 2 - O Cenário" : "Parte 3 - O Vídeo";
        
        let extraPhotoContext = "";
        if (state.currentPhase === 1) {
          extraPhotoContext = "\n(NOTA IMPORTANTE DA FASE 1: Esta foto serve para ajudar a identificar e descrever o animal. Continue na Fase 1 explorando com carinho os parâmetros obrigatórios: nome do bichinho, raça se aplicável, coloração de pelos/pele e se possui manchas, deficiência ou avariação, antes de qualquer menção ao cenário do vídeo).";
        }
        
        fullMessageToAgent = `[IMAGEM ANALISADA PELO AGENTE DE VISÃO ESPECIALISTA (${phaseTitle})]: ${visionData.description}${extraPhotoContext}\n\nComentário do usuário: ${userText || "Veja esta foto do meu pet!"}`;
      }
    } catch (visionErr) {
      console.warn("⚠️ Não foi possível analisar imagem via Agente de Visão:", visionErr);
    }
  }

  if (ui.bubbleText) {
    ui.bubbleText.innerHTML = 'Dr. Miau está pensando<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
  }

  try {
    const history = state.messages
      .filter(m => m.text !== INITIAL_MESSAGE)
      .map(m => ({
        role: m.role === "Voce" ? "user" : "model",
        text: m.text
      }));

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: fullMessageToAgent, history })
    });

    if (!res.ok) {
      throw new Error(`Servidor indisponível (${res.status})`);
    }

    let data = await res.json().catch(() => null);

    if (!data || typeof data.response !== "string" || !data.response.trim()) {
      data = {
        response: "Miau! *ronrom* Adorei conversar com você! Me conta mais sobre seu amiguinho!",
        sentiment: "alegre",
        phase: state.currentPhase || 1,
        progress: state.progress || 20
      };
    }

    // Limpeza de defesa contra resíduos de JSON bruto na resposta textual
    if (typeof data.response === "string") {
      let rText = data.response.trim();
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
      data.response = rText;
    }
    
    showThinking(false);
    setGenerating(false);
    showSpeaking(true);

    if (data.progress !== undefined) {
      setProgress(data.progress);
    }
    if (data.phase !== undefined) {
      state.currentPhase = data.phase;
    }

    // Registra que uma foto foi solicitada apenas se estivermos na fase 1
    const respLower = data.response.toLowerCase();
    if (state.currentPhase === 1 && (respLower.includes("foto") || respLower.includes("fotinha"))) {
      state.photoRequested = true;
    }

    const addedMsg = pushMessage("Agente", data.response);
    setBubble(data.response);
    setDockTitle("Pronto para conversar");

    // Se a resposta contiver um video_prompt gerado para o Magic Hour, guarda para consulta/testes
    if (data.video_prompt && typeof data.video_prompt === "string" && data.video_prompt.trim()) {
      state.lastGeneratedPrompt = {
        prompt: data.video_prompt.trim(),
        timestamp: new Date().toISOString(),
        jobId: data.jobId || null,
        status: data.video_status || "queued"
      };
      saveStateToCache();
      updatePromptBtnState();
    }

    // Tenta reproduzir o vídeo associado ao sentimento (alegre, neutro, preocupado, protetor, confuso)
    const fileMapping = {
      alegre: "feliz",
      neutro: "normal",
      preocupado: "triste",
      protetor: "raiva",
      confuso: "confuso",
      esperando: "esperando"
    };
    const videoName = fileMapping[data.sentiment] || "normal";
    const localUrl = getRandomVideoForEmotion(videoName);
    
    playEmotionalVideo(localUrl);

    // Termina a animação de fala após algum tempo
    setTimeout(() => showSpeaking(false), 4500);

    // Se a geração foi disparada, monitora o jobId
    if (data.jobId) {
      console.log(`[Magic Hour Triggered] Começando a escutar o jobId: ${data.jobId}`);
      pollVideoStatus(data.jobId, addedMsg.id);
    }

  } catch (err) {
    console.error("❌ [Erro no Chat / Comunicação]:", err.stack || err);
    if (err && err.message) {
      console.error("❌ [Detalhe do Erro]:", err.message);
    }
    showThinking(false);
    setGenerating(false);
    setDockTitle("Pronto para conversar");
    
    const fallbackMsg = "Ops, miau! Minha mente felina se distraiu por um momento. Poderia repetir?";
    pushMessage("Agente", fallbackMsg);
    setBubble(fallbackMsg);
  } finally {
    if (state.mode === "text") {
      ui.messageInput?.focus();
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Animação / Vídeo Controles
// ════════════════════════════════════════════════════════════════════════════

// ─── Preloader de Vídeos ──────────────────────────────────────────────────────
function preloadAllVideos() {
  console.log("[Preloader] Iniciando preloading em lote das animações do Dr. Miau...");
  const urls = [];
  for (const emotion in ANIMATION_POOL) {
    if (Array.isArray(ANIMATION_POOL[emotion])) {
      for (const item of ANIMATION_POOL[emotion]) {
        if (item.url && !urls.includes(item.url)) {
          urls.push(item.url);
        }
      }
    }
  }

  urls.forEach(url => {
    // Tenta cache HTTP via fetch sem criar elementos video redundantes
    fetch(url, { cache: "force-cache" })
      .then(res => {
        if (res.ok) console.log(`[Preloader] Cache HTTP bem-sucedido para: ${url}`);
      })
      .catch(() => {
        // Ignora falhas CORS
      });
  });
}

function transitionToVideo(videoUrl) {
  // Inicializa referências do buffer se necessário
  if (!state.activeVideo) {
    state.activeVideo = ui.drMiauVideoA;
    state.inactiveVideo = ui.drMiauVideoB;
  }
  
  const currentActive = state.activeVideo;
  const currentInactive = state.inactiveVideo;
  
  if (!currentActive || !currentInactive) return;
  
  console.log(`[Video Transition] Transicionando de ${currentActive.id} para ${currentInactive.id} com URL: ${videoUrl}`);
  
  // Trata erro de carregamento do elemento de vídeo
  currentInactive.onerror = () => {
    console.warn(`[Video Transition] Vídeo ${videoUrl} não pôde ser reproduzido. Ativando imagem de fallback.`);
    if (ui.drMiauImg) {
      ui.drMiauImg.classList.remove("hidden");
    }
  };

  // Define o source no vídeo inativo e desliga o loop
  currentInactive.src = videoUrl;
  currentInactive.loop = false;
  currentInactive.currentTime = 0;
  
  let transitioned = false;
  
  const performSwitch = () => {
    if (transitioned) return;
    transitioned = true;
    
    // Troca suave de visibilidade
    currentInactive.classList.remove("hidden");
    currentActive.classList.add("hidden");
    ui.drMiauImg?.classList.add("hidden");
    
    // Atualiza o estado
    state.activeVideo = currentInactive;
    state.inactiveVideo = currentActive;
    
    // Limpa os event listeners temporários
    currentInactive.onplaying = null;
    currentInactive.onseeked = null;
    currentInactive.oncanplay = null;
    
    // Pausa o anterior
    try {
      currentActive.pause();
    } catch (e) {}
  };
  
  try {
    currentInactive.load();
    currentInactive.muted = true;
    
    // Transiciona assim que começar a reproduzir de fato
    currentInactive.onplaying = () => {
      performSwitch();
    };
    
    // Se o navegador demorar ou tiver restrição, canplay serve como fallback acelerado
    currentInactive.oncanplay = () => {
      currentInactive.play()
        .then(() => {
          performSwitch();
        })
        .catch(err => {
          console.warn("[Video Transition] Falha ao dar play no oncanplay:", err);
          performSwitch(); // Força o switch mesmo se play travar por política de gesto
        });
    };
    
    currentInactive.play()
      .then(() => {
        performSwitch();
      })
      .catch(err => {
        console.warn("[Video Transition] Play inicial aguardando interação do usuário:", err);
      });
  } catch (err) {
    console.error("[Video Transition] Falha crítica na transição:", err);
    performSwitch();
  }
}

async function initializeIdleAnimation() {
  try {
    const localUrl = getRandomVideoForEmotion("bem_vindo");
    state.idleAnimationUrl = localUrl;
    playEmotionalVideo(localUrl);
  } catch (error) {
    console.error("Falha ao inicializar a animação de ociosidade:", error);
  }
}

function playEmotionalVideo(videoUrl) {
  state.currentEmotionalVideo = videoUrl;
  state.alternationStep = 0; // 0 significa: acabou de começar a emocional inicial
  state.alternationPlayCount = 1;
  state.videoPlayCount = 1;
  transitionToVideo(videoUrl);
}

function setVideoSrcAndPlay(videoUrl) {
  transitionToVideo(videoUrl);
}

function handleVideoEnded() {
  // Use as referências de buffer
  if (!state.activeVideo) return;

  const emotionalVideo = state.currentEmotionalVideo || getRandomVideoForEmotion("bem_vindo");

  // Se o passo atual for 0 (acabou de tocar a emocional inicial 1 vez):
  if (state.alternationStep === 0) {
    state.alternationStep = 1;
    state.alternationPlayCount = 1;
    setVideoSrcAndPlay(getRandomVideoForEmotion("normal"));
    console.log("[Alternation] Iniciou Passo 1 (Normal 3x). Execução 1/3");
  }
  // Passo 1: 3 vezes no normal
  else if (state.alternationStep === 1) {
    if (state.alternationPlayCount < 3) {
      state.alternationPlayCount++;
      setVideoSrcAndPlay(getRandomVideoForEmotion("normal"));
      console.log(`[Alternation] Passo 1 (Normal 3x). Execução ${state.alternationPlayCount}/3`);
    } else {
      state.alternationStep = 2;
      state.alternationPlayCount = 1;
      setVideoSrcAndPlay(emotionalVideo);
      console.log("[Alternation] Iniciou Passo 2 (Antiga 1x). Execução 1/1");
    }
  }
  // Passo 2: 1 vez na antiga (emocional)
  else if (state.alternationStep === 2) {
    state.alternationStep = 3;
    state.alternationPlayCount = 1;
    setVideoSrcAndPlay(getRandomVideoForEmotion("normal"));
    console.log("[Alternation] Iniciou Passo 3 (Normal 1x). Execução 1/1");
  }
  // Passo 3: 1 vez no normal
  else if (state.alternationStep === 3) {
    state.alternationStep = 4;
    state.alternationPlayCount = 1;
    setVideoSrcAndPlay(emotionalVideo);
    console.log("[Alternation] Iniciou Passo 4 (Antiga 3x). Execução 1/3");
  }
  // Passo 4: 3 vezes na antiga (emocional)
  else if (state.alternationStep === 4) {
    if (state.alternationPlayCount < 3) {
      state.alternationPlayCount++;
      setVideoSrcAndPlay(emotionalVideo);
      console.log(`[Alternation] Passo 4 (Antiga 3x). Execução ${state.alternationPlayCount}/3`);
    } else {
      state.alternationStep = 1;
      state.alternationPlayCount = 1;
      setVideoSrcAndPlay(getRandomVideoForEmotion("normal"));
      console.log("[Alternation] Reiniciou o ciclo. Passo 1 (Normal 3x). Execução 1/3");
    }
  }
}

function showGeneratedVideo(videoUrl, loop = false) {
  state.videoPlayCount = 1;
  transitionToVideo(videoUrl);
}

// ─── Modal de Vídeo Controles ────────────────────────────────────────────────
function openVideoModal(videoUrl) {
  const modal = document.getElementById("videoModalBackdrop");
  const videoPlayer = document.getElementById("modalVideoPlayer");
  const downloadBtn = document.getElementById("downloadVideoBtn");
  
  if (!modal || !videoPlayer || !downloadBtn) return;
  
  videoPlayer.src = videoUrl;
  downloadBtn.href = videoUrl;
  
  modal.classList.remove("hidden");
  
  try {
    videoPlayer.load();
    videoPlayer.play().catch(err => {
      console.warn("Autoplay do modal bloqueado:", err);
    });
  } catch (err) {
    console.error("Erro ao rodar vídeo no modal:", err);
  }
}

function closeVideoModal() {
  const modal = document.getElementById("videoModalBackdrop");
  const videoPlayer = document.getElementById("modalVideoPlayer");
  
  if (!modal || !videoPlayer) return;
  
  try {
    videoPlayer.pause();
    videoPlayer.src = "";
  } catch (e) {}
  
  modal.classList.add("hidden");
  
  // Reinicia o progresso vertical (contador) da entrevista
  setProgress(0);
  
  // Dr. Miau envia mensagem de continuidade
  const followUpText = "Que espetáculo de vídeo! 🎬 Ficou fantástico! Me conta: você quer fazer mais um vídeo para este pet ou criar outro personagem do zero? Estou pronto para começar as perguntas da nossa nova produção cinematográfica! Miau! 🍿🐾";
  pushMessage("Agente", followUpText);
  setBubble(followUpText);
}

// ════════════════════════════════════════════════════════════════════════════
//  Eventos de UI
// ════════════════════════════════════════════════════════════════════════════
function wireEvents() {
  // Delegação de clique (toda a página)
  document.addEventListener("click", (e) => {
    // Tab switching do histórico
    const tabBtn = e.target?.closest?.(".history-tab");
    if (tabBtn) {
      state.activeHistoryTab = tabBtn.dataset.tab;
      renderHistory();
      return;
    }

    // Fechar Modal de vídeo
    const modalCloseBtn = e.target?.closest?.("#closeVideoModal") || e.target?.closest?.("#closeVideoModalBtn");
    if (modalCloseBtn) {
      closeVideoModal();
      return;
    }

    const btn    = e.target?.closest?.("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "toggleHistory")     toggleHistory();
    if (action === "toggleMiniHistory") toggleMiniHistory();
    if (action === "toggleHelp")        toggleHelp();
    if (action === "toggleProfile")     toggleProfile();
    if (action === "toggleListening")   toggleListening();
    if (action === "resetChat")         resetChat();
    if (action === "setMode")           setMode(btn.dataset.mode);
  });

  // Fecha painéis ao clicar fora
  document.addEventListener("pointerdown", (e) => {
    if (state.historyOpen) {
      const inside = e.target?.closest?.('[data-ui="historyPopover"]');
      const toggle = e.target?.closest?.('[data-action="toggleHistory"]');
      if (!inside && !toggle) setHistoryOpen(false);
    }
    if (state.helpOpen) {
      const inside = e.target?.closest?.('[data-ui="helpPopover"]');
      const toggle = e.target?.closest?.('[data-action="toggleHelp"]');
      if (!inside && !toggle) setHelpOpen(false);
    }
    if (state.profileOpen) {
      const inside = e.target?.closest?.('#profileDropdown');
      const toggle = e.target?.closest?.('[data-action="toggleProfile"]');
      if (!inside && !toggle) setProfileOpen(false);
    }
  });

  // Tecla Escape fecha painéis
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (state.historyOpen) setHistoryOpen(false);
    if (state.helpOpen)    setHelpOpen(false);
    if (state.profileOpen) setProfileOpen(false);
  });

  // Eventos de Navegação dos Painéis do Dropdown
  const panelTargets = $$("[data-panel-target]");
  panelTargets.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.panelTarget;
      $$(".dropdown-panel").forEach(p => p.classList.add("hidden"));
      const targetPanel = $(`#panel-${target}`);
      if (targetPanel) {
        targetPanel.classList.remove("hidden");
      }
    });
  });

  const backBtns = $$(".panel-back-btn");
  backBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".dropdown-panel").forEach(p => p.classList.add("hidden"));
      $("#panel-main")?.classList.remove("hidden");
    });
  });

  $("#sendFeedbackBtn")?.addEventListener("click", () => {
    const txt = ($("#feedbackText")?.value ?? "").trim();
    if (txt) {
      const txtArea = $("#feedbackText");
      const sendBtn = $("#sendFeedbackBtn");
      if (txtArea) txtArea.style.display = "none";
      if (sendBtn) sendBtn.style.display = "none";
      $("#feedbackSuccess")?.classList.remove("hidden");
    }
  });

  const colorBtns = $$(".color-option");
  colorBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      colorBtns.forEach(b => {
        b.classList.remove("active");
        b.style.borderColor = "transparent";
      });
      btn.classList.add("active");
      btn.style.borderColor = "#fff";
      const color = btn.dataset.color;
      document.body.dataset.themeColor = color;
      try { localStorage.setItem("petAgent.themeColor", color); } catch {}
    });
  });

  // Habilita botão Enviar conforme digitação
  ui.messageInput?.addEventListener("input", updateComposerState);

  // Eventos do Modal de Diagnóstico de APIs
  const apiBtn = $("#apiStatusNavBtn");
  if (apiBtn) {
    apiBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openApiStatusModal(true);
    });
  }
  $("#closeApiModalBtn")?.addEventListener("click", () => openApiStatusModal(false));
  $("#refreshApiStatusBtn")?.addEventListener("click", () => fetchApiStatus());
  $("#apiModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target === $("#apiModalBackdrop")) openApiStatusModal(false);
  });

  // Eventos da prévia inline e confirmação de foto do pet
  $("#confirmPhotoSendBtn")?.addEventListener("click", () => {
    submitPhotoNow();
  });
  $("#cancelPhotoBtn")?.addEventListener("click", () => {
    clearSelectedImage();
    ui.messageInput?.focus();
  });

  // Eventos do Modal de Prompt Final (Magic Hour)
  $("#viewPromptBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openPromptModal(true);
  });
  $("#viewPromptFromVideoModalBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openPromptModal(true);
  });
  $("#closePromptModalBtn")?.addEventListener("click", () => openPromptModal(false));
  $("#closePromptModalFooterBtn")?.addEventListener("click", () => openPromptModal(false));
  $("#copyPromptBtn")?.addEventListener("click", copyPromptToClipboard);
  $("#refreshPromptBtn")?.addEventListener("click", async () => {
    await fetchLastPromptFromServer();
    renderPromptModalContent();
  });
  $("#promptModalBackdrop")?.addEventListener("click", (e) => {
    if (e.target === $("#promptModalBackdrop")) openPromptModal(false);
  });

  // Botão discreto de anexo de foto
  const imageAttachBtn = $("#imageAttachBtn");
  const imageFileInput = $("#imageFileInput");

  imageAttachBtn?.addEventListener("click", () => {
    imageFileInput?.click();
  });

  imageFileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  });

  // Suporte a arrastar e soltar (drag and drop) de fotos no composer
  ui.composer?.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    ui.composer.classList.add("drag-over");
  });

  ui.composer?.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    ui.composer.classList.remove("drag-over");
  });

  ui.composer?.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    ui.composer.classList.remove("drag-over");
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type && file.type.startsWith("image/")) {
      handleImageSelect(file);
    }
  });

  // Botão de Reset
  $('[data-action="resetChat"]')?.addEventListener("click", () => {
    resetChat();
  });

  // Botão de Repetir Última Instrução
  $("#retryLastBtn")?.addEventListener("click", () => {
    retryLastInstruction();
  });

  // Botão de Alternar Layout do Chat (Lado a Lado / Empilhado)
  $("#toggleLayoutBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleChatLayout();
  });

  // Submit do formulário de chat
  ui.composer?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.mode === "audio") { toggleListening(); return; }
    
    if (state.generating) {
      ui.messageInput?.focus();
      return;
    }

    const value = (ui.messageInput?.value ?? "").trim();
    const hasImage = Boolean(state.selectedImageBase64);

    if (!value && !hasImage) {
      ui.messageInput?.focus();
      return;
    }

    const imgBase64 = state.selectedImageBase64;
    const imgMime = state.selectedImageMime;

    ui.messageInput.value = "";
    clearSelectedImage();
    updateComposerState();

    // Mantém o chat sempre ativo e o cursor piscando imediatamente
    ui.messageInput?.focus();

    const displayUserText = value || (hasImage ? "Enviou uma foto do pet 📷" : "");
    pushMessage("Voce", displayUserText, { imageUrl: imgBase64 });

    agentRespond(value, imgBase64, imgMime);

    // Garante persistência do foco
    requestAnimationFrame(() => {
      ui.messageInput?.focus();
    });
  });

  // Garante que clicar na barra de chat mantenha o cursor piscando no input
  ui.composer?.addEventListener("click", (e) => {
    if (state.mode === "text" && !e.target.closest("button") && !e.target.closest("input")) {
      ui.messageInput?.focus();
    }
  });

  ui.miniHistory?.addEventListener("click", (e) => {
    if (state.mode === "text" && !e.target.closest("button") && !e.target.closest("a") && !e.target.closest("video") && !e.target.closest("input")) {
      ui.messageInput?.focus();
    }
  });
}

// ─── Verificação e Diagnóstico de Conexão das APIs ──────────────────────────────
async function fetchApiStatus() {
  try {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    updateApiStatusUI(data);
    return data;
  } catch (err) {
    console.warn("⚠️ Não foi possível verificar o status das APIs:", err);
    updateApiStatusUI({
      gemini: { connected: false, message: "Servidor Vercel não respondeu ao teste de status das APIs." },
      magicHour: { connected: false, message: "Servidor Vercel não respondeu ao teste de status das APIs." }
    });
  }
}

function updateApiStatusUI(data) {
  const gemini = data?.gemini || {};
  const magicHour = data?.magicHour || {};

  const dot = $("#apiStatusDot");
  const text = $("#apiStatusText");

  const geminiConnected = gemini.connected;
  const magicHourConnected = magicHour.connected;

  if (dot && text) {
    if (geminiConnected && magicHourConnected) {
      dot.className = "api-dot connected";
      text.textContent = "APIs OK";
    } else if (geminiConnected) {
      dot.className = "api-dot connected";
      text.textContent = "Gemini OK";
    } else if (magicHourConnected) {
      dot.className = "api-dot error";
      text.textContent = "Sem Gemini";
    } else {
      dot.className = "api-dot error";
      text.textContent = "Sem API";
    }
  }

  // Atualiza modal de diagnóstico
  const gDot = $("#geminiCardDot");
  const gBadge = $("#geminiCardBadge");
  const gMsg = $("#geminiCardMsg");

  if (gDot && gBadge && gMsg) {
    if (geminiConnected) {
      gDot.className = "api-card__dot connected";
      gBadge.className = "api-card__badge connected";
      gBadge.textContent = "Conectado";
    } else {
      gDot.className = "api-card__dot error";
      gBadge.className = "api-card__badge error";
      gBadge.textContent = "Desconectado";
    }
    gMsg.textContent = gemini.message || (geminiConnected ? "Conexão ativa com o Gemini!" : "Servidor sem chave GEMINI_API_KEY ou com falha de conexão.");
  }

  const mhDot = $("#magicHourCardDot");
  const mhBadge = $("#magicHourCardBadge");
  const mhMsg = $("#magicHourCardMsg");

  if (mhDot && mhBadge && mhMsg) {
    if (magicHourConnected) {
      mhDot.className = "api-card__dot connected";
      mhBadge.className = "api-card__badge connected";
      mhBadge.textContent = "Conectado";
    } else {
      mhDot.className = "api-card__dot error";
      mhBadge.className = "api-card__badge error";
      mhBadge.textContent = "Desconectado";
    }
    mhMsg.textContent = magicHour.message || (magicHourConnected ? "Chave configurada" : "Servidor sem chave MAGIC_HOUR_API_KEY.");
  }
}

function openApiStatusModal(open = true) {
  const backdrop = $("#apiModalBackdrop");
  if (!backdrop) return;
  if (open) {
    backdrop.classList.remove("hidden");
    fetchApiStatus();
  } else {
    backdrop.classList.add("hidden");
    if (state.mode === "text") ui.messageInput?.focus();
  }
}

// ─── Modal do Prompt Final Gerado (Magic Hour) ────────────────────────────────
function updatePromptBtnState() {
  const btn = $("#viewPromptBtn");
  if (!btn) return;
  const hasPrompt = Boolean(state.lastGeneratedPrompt && state.lastGeneratedPrompt.prompt);
  btn.classList.toggle("has-prompt", hasPrompt);
  if (hasPrompt) {
    btn.setAttribute("title", "Ver Prompt Final (Magic Hour) — Prompt Ativo!");
  } else {
    btn.setAttribute("title", "Ver Prompt Final (Magic Hour)");
  }
}

async function fetchLastPromptFromServer() {
  try {
    const res = await fetch("/api/last-prompt");
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.prompt) {
      state.lastGeneratedPrompt = {
        prompt: data.prompt,
        timestamp: data.timestamp,
        jobId: data.jobId,
        status: data.status
      };
    } else {
      state.lastGeneratedPrompt = null;
    }
    saveStateToCache();
    updatePromptBtnState();
    return data;
  } catch (err) {
    console.warn("Não foi possível buscar o último prompt do servidor:", err);
    return null;
  }
}

async function openPromptModal(open = true) {
  const backdrop = $("#promptModalBackdrop");
  if (!backdrop) return;

  if (open) {
    backdrop.classList.remove("hidden");
    renderPromptModalContent();
    // Busca versão mais recente do backend também para sincronizar
    const serverData = await fetchLastPromptFromServer();
    if (serverData) {
      renderPromptModalContent();
    }
  } else {
    backdrop.classList.add("hidden");
    if (state.mode === "text") ui.messageInput?.focus();
  }
}

function renderPromptModalContent() {
  const textElem = $("#promptModalText");
  const timeElem = $("#promptMetaTime");
  const jobElem = $("#promptMetaJob");
  const copyBtn = $("#copyPromptBtn");

  const promptInfo = state.lastGeneratedPrompt;

  if (promptInfo && promptInfo.prompt) {
    if (textElem) textElem.textContent = promptInfo.prompt;
    if (timeElem) {
      const d = promptInfo.timestamp ? new Date(promptInfo.timestamp) : new Date();
      timeElem.textContent = `📅 Gerado em: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
    if (jobElem) {
      if (promptInfo.jobId) {
        jobElem.textContent = `⚡ Job ID: ${promptInfo.jobId}`;
        jobElem.style.display = "inline-block";
      } else {
        jobElem.style.display = "none";
      }
    }
    if (copyBtn) copyBtn.disabled = false;
  } else {
    if (textElem) textElem.textContent = "Nenhum prompt foi gerado ainda nesta sessão. Complete o atendimento com o Dr. Miau para que ele crie o vídeo cinematográfico no Magic Hour!";
    if (timeElem) timeElem.textContent = "Sem registro ativo";
    if (jobElem) jobElem.style.display = "none";
    if (copyBtn) copyBtn.disabled = true;
  }
  updatePromptBtnState();
}

async function copyPromptToClipboard() {
  const promptInfo = state.lastGeneratedPrompt;
  const copyBtnText = $("#copyPromptBtnText");

  if (!promptInfo || !promptInfo.prompt) {
    if (copyBtnText) copyBtnText.textContent = "Nada a copiar";
    setTimeout(() => { if (copyBtnText) copyBtnText.textContent = "Copiar Prompt"; }, 2000);
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(promptInfo.prompt);
    } else {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = promptInfo.prompt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }

    if (copyBtnText) copyBtnText.textContent = "Copiado com Sucesso! ✓";
    setTimeout(() => {
      if (copyBtnText) copyBtnText.textContent = "Copiar Prompt";
    }, 2500);
  } catch (err) {
    console.error("Falha ao copiar:", err);
    if (copyBtnText) copyBtnText.textContent = "Erro ao Copiar";
    setTimeout(() => { if (copyBtnText) copyBtnText.textContent = "Copiar Prompt"; }, 2000);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Captura Global de Erros para o Console
// ════════════════════════════════════════════════════════════════════════════
window.addEventListener("error", (event) => {
  const errMsg = String(event.error?.message || event.message || "");
  if (errMsg.includes("Cannot set property fetch") || errMsg.includes("ResizeObserver loop")) {
    return;
  }
  console.error("❌ [Global Window Error Caught]:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("❌ [Global Unhandled Promise Rejection]:", event.reason);
});

// ════════════════════════════════════════════════════════════════════════════
//  Inicialização
// ════════════════════════════════════════════════════════════════════════════
function init() {
  // Carrega histórico e progresso salvos no cache local
  loadStateFromCache();

  // Inicializa referências do buffer de vídeo
  state.activeVideo = ui.drMiauVideoA;
  state.inactiveVideo = ui.drMiauVideoB;

  // Precarrega todas as animações para garantir transições instantâneas e sem engasgos
  preloadAllVideos();

  // Inicia a animação de ociosidade
  initializeIdleAnimation();

  // Alternância inteligente de vídeo de ociosidade nas referências dual-buffer
  if (ui.drMiauVideoA) {
    ui.drMiauVideoA.addEventListener("ended", () => {
      if (state.activeVideo === ui.drMiauVideoA) {
        handleVideoEnded();
      }
    });
  }
  if (ui.drMiauVideoB) {
    ui.drMiauVideoB.addEventListener("ended", () => {
      if (state.activeVideo === ui.drMiauVideoB) {
        handleVideoEnded();
      }
    });
  }

  renderHistory();
  renderMiniHistory();
  setBubble(INITIAL_MESSAGE);
  setProgress(state.progress);
  setHistoryOpen(false);
  setHelpOpen(false);

  // Restaura modo salvo (ignora erro de sandbox)
  const savedMode = (() => {
    try {
      const m = localStorage.getItem("petAgent.mode");
      return m === "audio" || m === "text" ? m : "text";
    } catch {
      return "text";
    }
  })();
  setMode(savedMode);

  // Restaura cor de tema salva
  try {
    const savedColor = localStorage.getItem("petAgent.themeColor") || "peach";
    document.body.dataset.themeColor = savedColor;
    const activeBtn = $(`.color-option[data-color="${savedColor}"]`);
    if (activeBtn) {
      $$(".color-option").forEach(b => {
        b.classList.remove("active");
        b.style.borderColor = "transparent";
      });
      activeBtn.classList.add("active");
      activeBtn.style.borderColor = "#fff";
    }
  } catch {}

  updateComposerState();
  updatePromptBtnState();
  wireEvents();

  // Restaura preferência de layout (lado a lado / empilhado)
  try {
    const savedLayout = localStorage.getItem("drMiau_chatLayout");
    if (savedLayout === "side-by-side") {
      setChatLayout(true);
    }
  } catch {}

  // Executa teste inicial das conexões de API no servidor
  fetchApiStatus();

  // Garante que o chat inicie imediatamente ativo com o cursor piscando
  if (state.mode === "text") {
    setTimeout(() => {
      ui.messageInput?.focus();
    }, 100);
  }

  console.info("🐱 Pet Agent iniciado — Inteligência artificial do Gemini linkada com Magic Hour.");
}

init();

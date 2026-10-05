/**
 * Dr. Miau Pet Agent - Aplicação Frontend Modular (ES6)
 * Orquestrador central que integra componentes, estado e serviços de API.
 */

import { $, $$, preventUnwantedZoom, scrollToBottom } from "./utils/dom.js";
import { 
  state, 
  INITIAL_MESSAGE, 
  getRandomVideoForEmotion, 
  generateUniqueId, 
  saveStateToCache, 
  loadStateFromCache, 
  getChatStorageKey 
} from "./state/store.js";
import { 
  postChatMessage, 
  postChatStream, 
  resetPromptOnServer, 
  logoutUserOnServer, 
  pollVideoTask 
} from "./services/api.service.js";
import { supportsSpeech, SpeechService } from "./services/speech.service.js";
import { ChatComponent } from "./components/chat.component.js";
import { VideoComponent } from "./components/video.component.js";
import { PhotoComponent } from "./components/photo.component.js";
import { ProgressComponent } from "./components/progress.component.js";
import { ModalComponent, GalleryManager } from "./components/modal.component.js";

// Instâncias dos componentes
let chat;
let video;
let photo;
let progress;
let modal;
let speech;

/**
 * Reseta a conversa local e no servidor
 */
export async function resetChat(isNewConversation = true) {
  const oldConvId = state.conversationId;
  const oldSessId = state.sessionId;
  const clearedAt = new Date().toISOString();

  try {
    localStorage.removeItem(getChatStorageKey(state.user.id, oldConvId));
    localStorage.removeItem("drMiau_chatState");
    localStorage.removeItem(`drMiau_activeConv_${state.user.id}`);
  } catch (e) {}

  if (isNewConversation) {
    state.conversationId = generateUniqueId("conv");
    state.sessionId = generateUniqueId("sess");
    sessionStorage.setItem("drMiau_conversationId", state.conversationId);
    sessionStorage.setItem("drMiau_sessionId", state.sessionId);
  }

  resetPromptOnServer({
    userId: state.user.id,
    sessionId: oldSessId,
    conversationId: oldConvId,
    newConversationId: state.conversationId,
    newSessionId: state.sessionId,
    clearedAt
  });

  state.messages = [{ id: `msg_${Date.now()}`, role: "Agente", text: INITIAL_MESSAGE, ts: Date.now() }];
  state.progress = 0;
  state.currentPhase = 1;
  state.photoRequested = false;
  state.photoRefused = false;
  state.userHasSentPhoto = false;
  state.lastGeneratedPrompt = null;
  state.lastUserSubmission = null;
  state.petProfile = null;
  state.generating = false;

  chat.showThinking(false);
  chat.setGenerating(false);
  photo.clear();

  const msgInput = $(".composer__input");
  if (msgInput) msgInput.value = "";

  chat.setDockTitle("Pronto para conversar");
  chat.renderHistory();
  chat.renderMiniHistory();
  chat.setBubble(INITIAL_MESSAGE);
  progress.setProgress(0);
  saveStateToCache();
  chat.updateComposerState();
  modal.renderPromptModalContent();
  modal.updatePromptBtnState();
  modal.updateProfileUI();
  video.playEmotionalVideo(getRandomVideoForEmotion("bem_vindo"));
}

/**
 * Desconecta o usuário ativo e inicia perfil visitante
 */
export async function logoutUser() {
  const clearedAt = new Date().toISOString();

  await logoutUserOnServer({
    userId: state.user.id,
    sessionId: state.sessionId,
    conversationId: state.conversationId
  });

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(`drMiau_chatState_${state.user.id}`) || k.startsWith(`drMiau_activeConv_${state.user.id}`) || k === "drMiau_chatState")) {
        localStorage.removeItem(k);
      }
    }
    sessionStorage.removeItem("drMiau_sessionId");
    sessionStorage.removeItem("drMiau_conversationId");
  } catch (e) {}

  const guestUser = {
    id: generateUniqueId("usr_guest"),
    name: "Visitante",
    email: "visitante@drmiau.app",
    role: "Tutor Visitante"
  };

  try {
    localStorage.setItem("drMiau_currentUser", JSON.stringify(guestUser));
  } catch (e) {}

  state.user = guestUser;
  state.sessionId = generateUniqueId("sess");
  state.conversationId = generateUniqueId("conv");
  sessionStorage.setItem("drMiau_sessionId", state.sessionId);
  sessionStorage.setItem("drMiau_conversationId", state.conversationId);

  modal.updateProfileUI();
  await resetChat(false);
  modal.setProfileOpen(false);
}

/**
 * Alterna entre contas de usuário com isolamento garantido
 */
export async function switchUserAccount(targetUser) {
  if (!targetUser || !targetUser.id) return;

  state.user = targetUser;
  try {
    localStorage.setItem("drMiau_currentUser", JSON.stringify(targetUser));
  } catch (e) {}

  state.sessionId = generateUniqueId("sess");
  state.conversationId = generateUniqueId("conv");
  sessionStorage.setItem("drMiau_sessionId", state.sessionId);
  sessionStorage.setItem("drMiau_conversationId", state.conversationId);

  modal.updateProfileUI();
  await resetChat(true);
  modal.setProfileOpen(false);
}

/**
 * Repete a última instrução válida enviada pelo usuário
 */
export async function retryLastInstruction() {
  if (state.generating) return;
  const last = state.lastUserSubmission;
  if (!last || (!last.text && !last.imageBase64)) {
    chat.pushMessage("Agente", "Nenhuma instrução anterior disponível para repetir. Me conte sobre seu pet!");
    return;
  }
  agentRespond(last.text, last.imageBase64, last.imageMime);
}

/**
 * Consulta de status do vídeo em segundo plano
 */
export async function pollVideoStatus(jobId, messageId, videoPrompt = "") {
  const msgIndex = state.messages.findIndex(m => m.id === messageId);
  if (msgIndex !== -1) {
    state.messages[msgIndex].videoStatus = "queued";
    chat.renderMiniHistory();
  }

  const pollStartTime = Date.now();
  progress.updateVideoProgress(10, "Conectando ao estúdio Atlas Cloud (Seedance 2.0)...", true, 0, {
    jobId,
    status: "iniciando",
    workerStage: "Iniciando"
  });

  let errorCount = 0;
  let pollTicks = 0;

  const pollInterval = setInterval(async () => {
    pollTicks++;

    try {
      const data = await pollVideoTask(jobId);
      const metrics = data.metrics || {};
      const elapsedSec = metrics.elapsedSeconds !== undefined ? metrics.elapsedSeconds : Math.round((Date.now() - pollStartTime) / 1000);
      const prog = progress.calculateRealTimeProgress(data, elapsedSec, pollTicks);

      const idx = state.messages.findIndex(m => m.id === messageId);
      if (idx === -1) {
        clearInterval(pollInterval);
        progress.updateVideoProgress(0, "", false);
        return;
      }

      errorCount = 0;

      if (prog.isCompleted && prog.videoUrl) {
        clearInterval(pollInterval);
        progress.updateVideoProgress(100, prog.desc, true, elapsedSec, {
          jobId,
          status: "completed",
          workerStage: "Concluído"
        });

        state.messages[idx].videoStatus = "completed";
        state.messages[idx].videoUrl = prog.videoUrl;
        state.messages[idx].text = "✨ Miau! Sua animação 3D de 15 segundos (720p 16:9) foi gerada com sucesso pela Atlas Cloud! Assista abaixo ou veja na Galeria: 🎬👇";
        chat.renderMiniHistory();

        video.playEmotionalVideo(getRandomVideoForEmotion("feliz"));
        chat.setBubble("✨ Miau! Sua animação 3D da Atlas Cloud (720p 15s) está pronta! Assista na tela ou acesse a Galeria!");

        GalleryManager.save(
          prog.videoUrl,
          videoPrompt || state.lastGeneratedPrompt?.prompt || "Animação 3D 720p gerada pela Atlas Cloud",
          state.petProfile?.name || "Pet Especial"
        );

        setTimeout(() => progress.updateVideoProgress(0, "", false), 2500);

      } else if (prog.isFailed) {
        clearInterval(pollInterval);
        progress.updateVideoProgress(0, "", false);

        state.messages[idx].videoStatus = "failed";
        state.messages[idx].text = `❌ Miau! Ocorreu uma falha no estúdio de vídeo da Atlas Cloud: ${prog.error}.`;
        chat.renderMiniHistory();
        chat.setBubble(`❌ Falha na Atlas Cloud: ${prog.error}`);

      } else {
        state.messages[idx].videoStatus = "processing";
        chat.renderMiniHistory();
        progress.updateVideoProgress(prog.percent, prog.desc, true, elapsedSec, {
          jobId,
          status: data.status,
          workerStage: prog.workerStage,
          elapsedSec
        });
      }
    } catch (err) {
      errorCount++;
      if (errorCount >= 600) {
        clearInterval(pollInterval);
        progress.updateVideoProgress(0, "", false);
        const idx = state.messages.findIndex(m => m.id === messageId);
        if (idx !== -1) {
          state.messages[idx].videoStatus = "failed";
          state.messages[idx].text = "❌ Miau! O tempo limite para receber a animação do estúdio Atlas Cloud expirou.";
          chat.renderMiniHistory();
        }
      }
    }
  }, 2000);
}

/**
 * Orquestra o envio da mensagem para o Dr. Miau
 */
export async function agentRespond(userText, imageBase64 = null, imageMime = null) {
  if (userText || imageBase64) {
    state.lastUserSubmission = {
      text: userText || "",
      imageBase64: imageBase64 || null,
      imageMime: imageMime || "image/jpeg"
    };
    saveStateToCache();
  }

  chat.showThinking(true);
  video.playEmotionalVideo("/videos/esperandoresposta.mp4");
  chat.setGenerating(true);
  chat.setDockTitle("Dr. Miau está pensando...");
  chat.showSpeaking(false);

  const bubbleText = $('[data-ui="bubbleText"]');
  if (bubbleText) {
    bubbleText.innerHTML = imageBase64 
      ? 'Recebendo a foto do seu pet<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>'
      : 'Dr. Miau está pensando<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
  }

  const messageToSend = userText || (imageBase64 ? "Enviei a foto do meu pet 📸" : "");

  try {
    const history = state.messages
      .filter(m => m.text !== INITIAL_MESSAGE)
      .map(m => ({
        role: m.role === "Voce" ? "user" : "model",
        text: m.text,
        image: m.imageUrl || null
      }));

    let data = null;
    let streamedText = "";
    let firstChunkReceived = false;

    const sessionState = {
      currentPhase: state.currentPhase || 1,
      progress: state.progress || 0,
      photoReceived: Boolean(imageBase64 || state.userHasSentPhoto || history.some(h => h.image)),
      photoRefused: Boolean(state.photoRefused),
      userId: state.user.id,
      sessionId: state.sessionId,
      conversationId: state.conversationId
    };

    const chatPayload = {
      message: messageToSend,
      image: imageBase64 || null,
      mimeType: imageMime || "image/jpeg",
      history,
      sessionState,
      userId: state.user.id,
      sessionId: state.sessionId,
      conversationId: state.conversationId
    };

    // 1. Tenta Streaming SSE
    try {
      await postChatStream(
        chatPayload,
        (chunk) => {
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            chat.showThinking(false);
            chat.showSpeaking(true);
            chat.setGenerating(false);
            chat.setDockTitle("Dr. Miau respondendo...");
            video.playEmotionalVideo(getRandomVideoForEmotion("normal"));
          }
          streamedText += chunk;
          chat.setBubble(streamedText);
          scrollToBottom($('[data-ui="miniHistory"]'), true);
        },
        (doneData) => {
          data = doneData;
        },
        () => {}
      );
    } catch (streamErr) {}

    // 2. Fallback REST tradicional
    if (!data) {
      data = await postChatMessage(chatPayload);
    }

    if (!data || typeof data.response !== "string" || !data.response.trim()) {
      data = {
        response: streamedText.trim() || "Miau! *ronrom* Adorei conversar com você! Me conta mais sobre seu amiguinho!",
        sentiment: "alegre",
        phase: state.currentPhase || 1,
        progress: state.progress || 20
      };
    }

    chat.showThinking(false);
    chat.setGenerating(false);
    chat.showSpeaking(true);

    if (data.progress !== undefined) {
      progress.setProgress(data.progress);
    }
    if (data.phase !== undefined) {
      state.currentPhase = data.phase;
    }
    if (data.pet_profile) {
      state.petProfile = data.pet_profile;
    }

    if (data.photo_requested && !state.userHasSentPhoto && !state.photoRefused) {
      state.photoRequested = true;
    } else if (state.userHasSentPhoto || state.photoRefused) {
      state.photoRequested = false;
    }

    const addedMsg = chat.pushMessage("Agente", data.response);
    chat.setBubble(data.response);
    chat.setDockTitle("Pronto para conversar");

    // Botão de confirmação rápida se pronto
    if (data.ready_for_confirmation) {
      state.readyForConfirmation = true;
      setTimeout(() => {
        const miniContainer = $('[data-ui="miniHistory"]');
        if (miniContainer && !document.getElementById("quickConfirmBox")) {
          const confirmBox = document.createElement("div");
          confirmBox.id = "quickConfirmBox";
          confirmBox.className = "quick-confirm-box";
          confirmBox.innerHTML = `
            <button class="quick-confirm-btn" onclick="window.sendQuickConfirmation()">
              🎬 Sim, autorizar e gerar animação 3D agora! ✨
            </button>
          `;
          miniContainer.appendChild(confirmBox);
          scrollToBottom(miniContainer, true);
        }
      }, 300);
    } else {
      state.readyForConfirmation = false;
      const oldBox = document.getElementById("quickConfirmBox");
      if (oldBox) oldBox.remove();
    }

    if (data.video_prompt && typeof data.video_prompt === "string" && data.video_prompt.trim()) {
      state.lastGeneratedPrompt = {
        prompt: data.video_prompt.trim(),
        timestamp: new Date().toISOString(),
        jobId: data.jobId || null,
        status: data.video_status || "queued"
      };
      saveStateToCache();
      modal.updatePromptBtnState();
    }

    const fileMapping = {
      alegre: "feliz",
      neutro: "normal",
      preocupado: "triste",
      protetor: "raiva",
      confuso: "confuso",
      esperando: "esperando"
    };
    const videoName = fileMapping[data.sentiment] || "normal";
    video.playEmotionalVideo(getRandomVideoForEmotion(videoName));

    setTimeout(() => chat.showSpeaking(false), 4500);

    if (data.jobId) {
      pollVideoStatus(data.jobId, addedMsg.id, data.video_prompt || "");
    } else if (data.trigger_video_generation && !data.jobId) {
      const errDetail = data.api_status?.atlascloud_error || "Servidor não retornou taskId de geração da Atlas Cloud.";
      const fallbackMsgIndex = state.messages.findIndex(m => m.id === addedMsg.id);
      if (fallbackMsgIndex !== -1) {
        state.messages[fallbackMsgIndex].videoStatus = "failed";
        state.messages[fallbackMsgIndex].text += `\n\n⚠️ (Estúdio Atlas Cloud: ${errDetail})`;
        chat.renderMiniHistory();
      }
      chat.setBubble(`❌ Ocorreu um erro no estúdio Atlas Cloud: ${errDetail}`);
    }

  } catch (err) {
    chat.showThinking(false);
    chat.setGenerating(false);
    chat.setDockTitle("Pronto para conversar");
    
    const fallbackMsg = "Ops, miau! Minha mente felina se distraiu por um momento. Poderia repetir?";
    chat.pushMessage("Agente", fallbackMsg);
    chat.setBubble(fallbackMsg);
  } finally {
    if (state.mode === "text") {
      $(".composer__input")?.focus();
    }
  }
}

/**
 * Conecta os eventos de interface do usuário
 */
function wireEvents() {
  const composer = $('[data-ui="composer"]');
  const messageInput = $(".composer__input");
  const sendButton = $(".composer__send");

  if (composer) {
    composer.addEventListener("submit", (e) => {
      e.preventDefault();
      if (state.generating) return;

      const text = (messageInput?.value ?? "").trim();
      const hasImage = Boolean(state.selectedImageBase64);

      if (!text && !hasImage) return;

      const currentImg = state.selectedImageBase64;
      const currentMime = state.selectedImageMime;

      if (messageInput) messageInput.value = "";
      photo.clear();

      chat.pushMessage("Voce", text || "Enviei uma foto do meu pet 📸", {
        imageUrl: currentImg
      });

      agentRespond(text, currentImg, currentMime);
    });
  }

  if (messageInput) {
    messageInput.addEventListener("input", () => chat.updateComposerState());
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        composer?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    });
  }

  const newChatBtn = $("#newChatBtn");
  if (newChatBtn) newChatBtn.addEventListener("click", () => resetChat(true));

  const toggleLayoutBtn = $("#toggleChatLayoutBtn");
  if (toggleLayoutBtn) toggleLayoutBtn.addEventListener("click", () => chat.toggleChatLayout());

  const miniToggleBtn = $("#toggleMiniHistoryBtn");
  if (miniToggleBtn) miniToggleBtn.addEventListener("click", () => chat.toggleMiniHistory());

  const historyToggle = $('[data-action="toggleHistory"]');
  if (historyToggle) historyToggle.addEventListener("click", () => chat.toggleHistory());

  const helpToggle = $('[data-action="toggleHelp"]');
  if (helpToggle) helpToggle.addEventListener("click", () => modal.toggleHelp());

  const profileBtn = $("#profileDropdownBtn");
  if (profileBtn) profileBtn.addEventListener("click", () => modal.toggleProfile());

  const viewPromptBtn = $("#viewPromptBtn");
  if (viewPromptBtn) viewPromptBtn.addEventListener("click", () => modal.openPromptModal(true));

  const closePromptBtn = $("#closePromptModalBtn");
  if (closePromptBtn) closePromptBtn.addEventListener("click", () => modal.openPromptModal(false));

  const apiStatusBtn = $("#apiStatusNavBtn");
  if (apiStatusBtn) apiStatusBtn.addEventListener("click", () => modal.openApiStatusModal(true));

  const closeApiBtn = $("#closeApiModalBtn");
  if (closeApiBtn) closeApiBtn.addEventListener("click", () => modal.openApiStatusModal(false));

  const galleryBtn = $("#chatGalleryBtn");
  if (galleryBtn) galleryBtn.addEventListener("click", () => GalleryManager.open());

  const closeGalleryBtn = $("#closeGalleryModalBtn");
  const closeGalleryFooterBtn = $("#closeGalleryModalFooterBtn");
  if (closeGalleryBtn) closeGalleryBtn.addEventListener("click", () => GalleryManager.close());
  if (closeGalleryFooterBtn) closeGalleryFooterBtn.addEventListener("click", () => GalleryManager.close());

  // Abas de Modo (Texto / Áudio)
  $$('[data-action="setMode"]').forEach(tab => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode;
      state.mode = mode;
      $$('[data-action="setMode"]').forEach(t => t.classList.toggle("mode-tab--active", t.dataset.mode === mode));
      const composerEl = $('[data-ui="composer"]');
      if (composerEl) composerEl.classList.toggle("composer--audio", mode === "audio");
      if (mode === "text") {
        speech.stop();
        messageInput?.focus();
      }
      chat.updateComposerState();
    });
  });

  // Botão do Microfone
  const micBtn = $('[data-action="toggleListening"]');
  if (micBtn) {
    micBtn.addEventListener("click", () => {
      if (speech.isListening()) {
        speech.stop();
        micBtn.dataset.state = "idle";
        chat.setDockTitle("Toque no microfone para falar");
      } else {
        if (!supportsSpeech()) {
          chat.pushMessage("Agente", "Seu navegador não suporta reconhecimento de voz. Use o modo texto.");
          return;
        }
        try {
          speech.start();
          micBtn.dataset.state = "listening";
          chat.setDockTitle("Ouvindo...");
        } catch (e) {
          micBtn.dataset.state = "idle";
        }
      }
    });
  }

  // Abas do Histórico
  $$(".history-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      state.activeHistoryTab = tab.dataset.tab;
      chat.renderHistory();
    });
  });

  // Fechar ao clicar fora ou pressionar Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      modal.setHelpOpen(false);
      chat.setHistoryOpen(false);
      modal.setProfileOpen(false);
      modal.openPromptModal(false);
      modal.openApiStatusModal(false);
      GalleryManager.close();
      video.closeVideoModal();
    }
  });

  preventUnwantedZoom();
}

/**
 * Inicialização Completa da Aplicação
 */
export function init() {
  chat = new ChatComponent({
    state,
    onRetryLastInstruction: () => retryLastInstruction(),
    onSendQuickConfirmation: () => {
      const confirmText = "Sim! Pode iniciar a renderização 3D na Atlas Cloud agora mesmo!";
      chat.pushMessage("Voce", confirmText);
      agentRespond(confirmText);
    }
  });

  video = new VideoComponent({
    state,
    onVideoModalClosed: () => {
      progress.setProgress(0);
      const followUpText = "Que espetáculo de vídeo! 🎬 Ficou fantástico! Me conta: você quer fazer mais um vídeo para este pet ou criar outro personagem do zero? Estou pronto para a próxima produção! Miau! 🍿🐾";
      chat.pushMessage("Agente", followUpText);
      chat.setBubble(followUpText);
    }
  });

  photo = new PhotoComponent({
    state,
    onPhotoSelected: () => chat.updateComposerState(),
    onPhotoCleared: () => chat.updateComposerState(),
    onPhotoSubmitted: () => {
      const form = $('[data-ui="composer"]');
      if (form) form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    },
    onPhotoSkipped: () => {
      state.photoRefused = true;
      state.photoRequested = false;
      saveStateToCache();
      chat.renderMiniHistory();
      const skipText = "Prefiro continuar apenas com a descrição do meu pet";
      chat.pushMessage("Voce", skipText);
      agentRespond(skipText);
    }
  });

  progress = new ProgressComponent({ state });

  modal = new ModalComponent({
    state,
    onResetChat: () => resetChat(true),
    onLogout: () => logoutUser(),
    onSwitchUser: (u) => switchUserAccount(u)
  });

  speech = new SpeechService({
    onResult: (text) => {
      const msgInput = $(".composer__input");
      if (msgInput) {
        msgInput.value = text;
        chat.updateComposerState();
      }
      if (text.trim()) {
        chat.pushMessage("Voce", text);
        agentRespond(text);
      }
    },
    onError: (err) => {
      chat.pushMessage("Agente", "Não consegui entender a fala no momento. Se preferir, digite no modo texto.");
      chat.setDockTitle("Toque no microfone para falar");
    },
    onStart: () => {
      chat.setDockTitle("Ouvindo...");
    },
    onEnd: () => {
      const micBtn = $('[data-action="toggleListening"]');
      if (micBtn) micBtn.dataset.state = "idle";
      if (state.mode === "audio") chat.setDockTitle("Toque no microfone para falar");
    }
  });

  loadStateFromCache();

  wireEvents();
  modal.updateProfileUI();
  modal.updatePromptBtnState();
  chat.renderHistory();
  chat.renderMiniHistory();
  chat.setBubble(state.messages[state.messages.length - 1]?.text || INITIAL_MESSAGE);
  progress.setProgress(state.progress || 0);

  const savedLayout = localStorage.getItem("drMiau_chatLayout");
  if (savedLayout === "side") {
    chat.setChatLayout(true);
  }

  video.preloadAllVideos();
  video.playEmotionalVideo(getRandomVideoForEmotion("bem_vindo"));

  console.log("🐾 Dr. Miau Pet Agent (Frontend Modular ES6) inicializado com sucesso!");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

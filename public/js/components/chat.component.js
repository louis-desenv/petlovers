/**
 * Componente do Chat, Histórico e Mini-Histórico do Dr. Miau
 */

import { $, $$, uid, scrollToBottom } from "../utils/dom.js";
import { cleanPortugueseText } from "../utils/text.js";
import { INITIAL_MESSAGE, saveStateToCache } from "../state/store.js";

export class ChatComponent {
  constructor({ state, onRetryLastInstruction, onSendQuickConfirmation }) {
    this.state = state;
    this.onRetryLastInstruction = onRetryLastInstruction;
    this.onSendQuickConfirmation = onSendQuickConfirmation;

    this.ui = {
      bubbleText: $('[data-ui="bubbleText"]'),
      agentBubble: $(".agent-bubble"),
      dockTitle: $('[data-ui="dockTitle"]'),
      composer: $('[data-ui="composer"]'),
      messageInput: $(".composer__input"),
      sendButton: $(".composer__send"),
      historyPopover: $('[data-ui="historyPopover"]'),
      historyList: $('[data-ui="historyList"]'),
      miniHistory: $('[data-ui="miniHistory"]'),
      voiceLabel: $('[data-ui="voiceLabel"]'),
      agentWrap: $('[data-ui="agentWrap"]'),
      thinkingIndicator: $("#thinkingIndicator"),
      miniHistoryToggleText: $("#mini-history-btn-text")
    };

    window.sendQuickConfirmation = () => {
      const oldBox = document.getElementById("quickConfirmBox");
      if (oldBox) oldBox.remove();
      if (this.onSendQuickConfirmation) this.onSendQuickConfirmation();
    };
  }

  setBubble(text) {
    if (this.ui.bubbleText) this.ui.bubbleText.textContent = cleanPortugueseText(text);
  }

  setDockTitle(text) {
    if (this.ui.dockTitle) this.ui.dockTitle.textContent = text;
  }

  setVoiceLabel(text) {
    if (this.ui.voiceLabel) this.ui.voiceLabel.textContent = text;
  }

  setSendEnabled(enabled) {
    if (!this.ui.sendButton) return;
    this.ui.sendButton.disabled = !enabled;
    this.ui.sendButton.setAttribute("aria-disabled", String(!enabled));
  }

  updateComposerState() {
    if (this.state.generating) {
      this.setSendEnabled(false);
      return;
    }
    const value = (this.ui.messageInput?.value ?? "").trim();
    const hasImage = Boolean(this.state.selectedImageBase64);
    this.setSendEnabled(this.state.mode === "text" && (value.length > 0 || hasImage));
  }

  setGenerating(loading) {
    this.state.generating = loading;
    this.ui.composer?.classList.toggle("is-loading", loading);

    const sendIcon = this.ui.sendButton?.querySelector(".send-icon");
    const spinner = this.ui.sendButton?.querySelector(".send-spinner");

    if (sendIcon && spinner) {
      sendIcon.classList.toggle("hidden", loading);
      spinner.classList.toggle("hidden", !loading);
    }

    if (this.ui.messageInput) {
      this.ui.messageInput.disabled = false;
      this.ui.messageInput.placeholder = loading 
        ? "Dr. Miau está pensando... pode continuar digitando!" 
        : "Fale sobre o seu pet…";
      if (this.state.mode === "text") {
        this.ui.messageInput.focus();
      }
    }

    this.updateComposerState();
  }

  showThinking(show) {
    this.ui.thinkingIndicator?.classList.toggle("hidden", !show);
    this.ui.agentWrap?.classList.toggle("is-thinking", show);
  }

  showSpeaking(show) {
    this.ui.agentWrap?.classList.toggle("is-speaking", show);
    this.ui.agentBubble?.classList.toggle("is-speaking", show);
    this.state.agent.speaking = show;
  }

  pushMessage(role, text, extra = {}) {
    const cleanText = cleanPortugueseText(text);
    const msg = { id: uid(), role, text: cleanText, ts: Date.now(), ...extra };
    this.state.messages.push(msg);

    if (role === "Agente") {
      this.state.agent.lastFull = cleanText;
      this.setBubble(cleanText);
    }

    saveStateToCache();
    this.renderHistory();
    this.renderMiniHistory();

    scrollToBottom(this.ui.miniHistory, true);
    scrollToBottom(this.ui.historyList, true);
    return msg;
  }

  renderHistory() {
    if (!this.ui.historyList) return;
    this.ui.historyList.innerHTML = "";

    const tab = this.state.activeHistoryTab || "messages";

    $$(".history-tab").forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    if (tab === "messages") {
      for (const msg of this.state.messages.slice(-60).reverse()) {
        const side = msg.role === "Voce" ? "me" : "agent";
        const item = document.createElement("div");
        item.className = `item item--${side}`;
        item.setAttribute("role", "listitem");

        const dot = document.createElement("div");
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

        if (msg.videoUrl) {
          const video = document.createElement("video");
          video.className = "mini-item__video";
          video.src = msg.videoUrl;
          video.controls = true;
          video.playsInline = true;
          video.style.marginTop = "8px";
          video.onerror = () => {
            if (video.src && !video.src.includes("magichour_fallback.mp4")) {
              video.src = "/videos/magichour_fallback.mp4";
            }
          };
          bubble.append(video);
        }

        item.append(dot, bubble);
        this.ui.historyList.append(item);
      }
    } else if (tab === "videos") {
      const videos = this.state.messages.filter(m => m.videoUrl);
      if (videos.length === 0) {
        const empty = document.createElement("p");
        empty.className = "history__empty";
        empty.textContent = "Nenhum vídeo gerado ainda. Complete o questionário do Dr. Miau para ver sua obra de arte aqui!";
        this.ui.historyList.append(empty);
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
        video.onerror = () => {
          if (video.src && !video.src.includes("magichour_fallback.mp4")) {
            video.src = "/videos/magichour_fallback.mp4";
          }
        };

        const info = document.createElement("div");
        info.className = "history-video-card__info";

        const title = document.createElement("p");
        title.className = "history-video-card__title";
        const date = new Date(msg.ts);
        title.textContent = `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'})}`;

        const downloadBtn = document.createElement("a");
        downloadBtn.href = msg.videoUrl;
        downloadBtn.download = "dr_miau_video.mp4";
        downloadBtn.className = "history-video-card__download";
        downloadBtn.target = "_blank";
        downloadBtn.rel = "noopener noreferrer";
        downloadBtn.innerHTML = `Baixar`;

        info.append(title, downloadBtn);
        card.append(video, info);
        grid.append(card);
      }
      this.ui.historyList.append(grid);
    }

    scrollToBottom(this.ui.historyList, true);
  }

  renderMiniHistory() {
    if (!this.ui.miniHistory) return;

    if (this.ui.miniHistoryToggleText) {
      this.ui.miniHistoryToggleText.textContent = this.state.miniHistoryVisible ? "Ocultar" : "Mostrar";
    }

    const activeMessages = this.state.messages;
    if (activeMessages.length === 0) {
      this.ui.miniHistory.innerHTML = "";
      this.ui.miniHistory.classList.add("collapsed");
      return;
    }

    this.ui.miniHistory.classList.toggle("collapsed", !this.state.miniHistoryVisible);
    this.ui.miniHistory.innerHTML = "";

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

        if (msg === lastEight[lastEight.length - 1] && msg.text !== INITIAL_MESSAGE && !this.state.generating) {
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
            if (this.onRetryLastInstruction) this.onRetryLastInstruction();
          });
          item.append(retryAction);
        }

        if (msg === lastEight[lastEight.length - 1] && !isMe && this.state.photoRequested && !this.state.userHasSentPhoto && !this.state.photoRefused && !this.state.generating) {
          const photoCard = document.createElement("div");
          photoCard.className = "chat-photo-prompt-card";
          photoCard.innerHTML = `
            <div class="photo-prompt-card__header">
              <span class="photo-prompt-card__icon" aria-hidden="true">📸</span>
              <div class="photo-prompt-card__texts">
                <strong>Gostaria de enviar uma foto do seu pet?</strong>
                <p>A foto servirá como referência para personalizar o vídeo 3D. Se preferir, podemos continuar apenas com a sua descrição!</p>
              </div>
            </div>
            <div class="photo-prompt-card__actions">
              <button type="button" class="photo-prompt-btn photo-prompt-btn--upload" onclick="window.triggerPetPhotoUpload()">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                Enviar foto do pet
              </button>
              <button type="button" class="photo-prompt-btn photo-prompt-btn--skip" onclick="window.skipPetPhotoUpload()">
                Continuar apenas com a descrição
              </button>
            </div>
          `;
          item.append(photoCard);
        }

        if (msg.videoUrl) {
          const video = document.createElement("video");
          video.className = "mini-item__video";
          video.src = msg.videoUrl;
          video.controls = true;
          video.autoplay = false;
          video.playsInline = true;
          video.onerror = () => {
            if (video.src && !video.src.includes("magichour_fallback.mp4")) {
              video.src = "/videos/magichour_fallback.mp4";
            }
          };
          item.append(video);
        } else if (msg.videoStatus) {
          const statusEl = document.createElement("div");
          statusEl.className = "mini-item__status";
          statusEl.style.marginTop = "8px";
          statusEl.style.fontSize = "12px";
          statusEl.style.opacity = "0.8";
          statusEl.style.fontStyle = "italic";

          let statusText = "🎬 Preparando renderização no estúdio";
          if (msg.videoStatus === "queued") statusText = "⏳ Vídeo na fila";
          else if (msg.videoStatus === "processing") statusText = "⚙️ Desenhando frames em 3D...";
          else if (msg.videoStatus === "failed") statusText = "❌ Falha ao processar o vídeo.";

          statusEl.innerHTML = `<span class="typing-dots">${statusText}<span>.</span><span>.</span><span>.</span></span>`;
          item.append(statusEl);
        }
      }

      this.ui.miniHistory.append(item);
    }

    scrollToBottom(this.ui.miniHistory, true);
  }

  toggleMiniHistory() {
    this.state.miniHistoryVisible = !this.state.miniHistoryVisible;
    this.renderMiniHistory();
  }

  setHistoryOpen(open) {
    this.state.historyOpen = open;
    if (this.ui.historyPopover) {
      this.ui.historyPopover.classList.toggle("hidden", !open);
      this.ui.historyPopover.setAttribute("aria-hidden", String(!open));
    }
    const toggle = $('[data-action="toggleHistory"]');
    if (toggle) toggle.setAttribute("aria-expanded", String(open));
    if (open) this.renderHistory();
  }

  toggleHistory() {
    this.setHistoryOpen(!this.state.historyOpen);
  }

  setChatLayout(isSideBySide) {
    const layoutWrapper = document.querySelector(".chat-layout-wrapper");
    const layoutBtn = document.getElementById("toggleChatLayoutBtn");
    if (!layoutWrapper) return;

    if (isSideBySide) {
      layoutWrapper.classList.add("layout-side-by-side");
      if (layoutBtn) {
        layoutBtn.title = "Layout Lado a Lado ativado. Clique para alternar para visualização empilhada.";
        layoutBtn.classList.add("active");
      }
    } else {
      layoutWrapper.classList.remove("layout-side-by-side");
      if (layoutBtn) {
        layoutBtn.title = "Layout Empilhado ativado. Clique para alternar para visualização lado a lado.";
        layoutBtn.classList.remove("active");
      }
    }
    try {
      localStorage.setItem("drMiau_chatLayout", isSideBySide ? "side" : "stacked");
    } catch (e) {}
  }

  toggleChatLayout() {
    const layoutWrapper = document.querySelector(".chat-layout-wrapper");
    const isCurrentlySide = layoutWrapper?.classList.contains("layout-side-by-side");
    this.setChatLayout(!isCurrentlySide);
  }
}

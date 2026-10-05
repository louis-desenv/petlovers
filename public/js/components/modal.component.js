/**
 * Componente de Modais, Galeria de Vídeos e Diálogos de Sistema
 */

import { $, $$ } from "../utils/dom.js";
import { fetchApiStatus, fetchLastPrompt, updateAtlasKey } from "../services/api.service.js";

export const GalleryManager = {
  STORAGE_KEY: "drMiau_atlas_gallery_v3",

  getAll() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter(v => v && v.videoUrl && !v.id?.startsWith("demo_") && !v.videoUrl.includes("demo"));
        }
      }
    } catch (e) {
      console.warn("[Gallery] Falha ao ler localStorage da galeria:", e);
    }
    return [];
  },

  save(videoUrl, prompt = "", petName = "Seu Pet") {
    if (!videoUrl) return;
    if (videoUrl.includes("esperandoresposta.mp4") || videoUrl.includes("normal.mp4")) return;

    try {
      let list = this.getAll();
      if (list.some(v => v.videoUrl === videoUrl)) return;
      const newItem = {
        id: "atlas_" + Date.now(),
        videoUrl: videoUrl,
        prompt: prompt || "Animação 3D cinematográfica gerada pela Atlas Cloud",
        petName: petName || "Pet Especial",
        createdAt: new Date().toISOString(),
        resolution: "720p",
        duration: 15,
        source: "Atlas Cloud"
      };
      list.unshift(newItem);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      this.render();
    } catch (e) {
      console.warn("[Gallery] Erro ao salvar vídeo na galeria:", e);
    }
  },

  delete(id) {
    try {
      let list = this.getAll().filter(v => v.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      this.render();
    } catch (e) {
      console.warn("[Gallery] Erro ao excluir vídeo da galeria:", e);
    }
  },

  isOpen() {
    const backdrop = document.getElementById("galleryModalBackdrop");
    if (!backdrop) return false;
    return !backdrop.classList.contains("hidden") && backdrop.style.display === "flex";
  },

  open() {
    const backdrop = document.getElementById("galleryModalBackdrop");
    const btn = document.getElementById("chatGalleryBtn");
    if (!backdrop) return;
    this.render();
    backdrop.classList.remove("hidden");
    backdrop.style.display = "flex";
    backdrop.setAttribute("aria-hidden", "false");
    if (btn) {
      btn.classList.add("is-active");
      btn.setAttribute("aria-expanded", "true");
    }
  },

  close() {
    const backdrop = document.getElementById("galleryModalBackdrop");
    const btn = document.getElementById("chatGalleryBtn");
    if (!backdrop) return;
    backdrop.classList.add("hidden");
    backdrop.style.display = "none";
    backdrop.setAttribute("aria-hidden", "true");
    if (btn) {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-expanded", "false");
    }
    const videos = backdrop.querySelectorAll("video");
    videos.forEach(v => {
      try { v.pause(); } catch (_) {}
    });
  },

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  },

  render() {
    const grid = document.getElementById("galleryModalGrid");
    if (!grid) return;
    const videos = this.getAll();

    if (videos.length === 0) {
      grid.innerHTML = `
        <div class="gallery-empty">
          <svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <line x1="7" y1="2" x2="7" y2="22"></line>
            <line x1="17" y1="2" x2="17" y2="22"></line>
            <line x1="2" y1="12" x2="22" y2="12"></line>
          </svg>
          <h3>Nenhuma animação gerada ainda</h3>
          <p>Esta galeria exibirá <strong>exclusivamente</strong> os vídeos 3D gerados pela <strong>Atlas Cloud</strong> ao final de uma conversa concluída com o Dr. Miau.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = videos.map(item => `
      <div class="gallery-card">
        <div class="gallery-card__video-wrap">
          <video src="${item.videoUrl}" controls playsinline preload="metadata" class="gallery-card__video"></video>
          <span class="gallery-card__badge">${item.resolution || "720p"} • ${item.duration || 15}s • Atlas Cloud</span>
        </div>
        <div class="gallery-card__info">
          <div class="gallery-card__title">
            <span>🎬 ${item.petName || "Pet Especial"}</span>
            <span class="gallery-card__time">${new Date(item.createdAt).toLocaleDateString("pt-BR")}</span>
          </div>
          <p class="gallery-card__prompt">"${item.prompt || "Animação 3D cinematográfica do pet gerada pela Atlas Cloud"}"</p>
          <div class="gallery-card__actions">
            <button class="gallery-card__btn gallery-card__btn--delete" onclick="window.GalleryManager.delete('${item.id}')">
              Excluir
            </button>
            <a href="${item.videoUrl}" download="dr-miau-atlas-${(item.petName || "pet").toLowerCase().replace(/\s+/g, '-')}.mp4" target="_blank" rel="noreferrer" class="gallery-card__btn gallery-card__btn--download">
              Baixar MP4
            </a>
          </div>
        </div>
      </div>
    `).join("");
  }
};

export class ModalComponent {
  constructor({ state, onResetChat, onLogout, onSwitchUser }) {
    this.state = state;
    this.onResetChat = onResetChat;
    this.onLogout = onLogout;
    this.onSwitchUser = onSwitchUser;

    this.initGlobalBindings();
  }

  initGlobalBindings() {
    window.GalleryManager = GalleryManager;
    window.openGalleryModal = (open = null) => {
      if (open === true) GalleryManager.open();
      else if (open === false) GalleryManager.close();
      else GalleryManager.toggle();
    };
    window.toggleGalleryModal = () => GalleryManager.toggle();
    window.closeGalleryModal = () => GalleryManager.close();
    window.deleteGalleryVideo = (id) => GalleryManager.delete(id);

    window.closeUserModal = () => this.setProfileOpen(false);
    window.handleLogoutClick = () => {
      if (this.onLogout) this.onLogout();
    };
    window.handleUserSwitch = (targetUser) => {
      if (this.onSwitchUser) this.onSwitchUser(targetUser);
    };
  }

  updateProfileUI() {
    const avatar = $("#dropdownAvatar") || $(".dropdown-avatar");
    const name = $("#dropdownUserName") || $(".dropdown-user-name");
    const handle = $("#dropdownUserHandle") || $(".dropdown-user-handle");
    const navBtn = $(".profile-btn");

    if (this.state.user) {
      const initial = (this.state.user.name || "A")[0].toUpperCase();
      if (avatar) avatar.textContent = initial;
      if (name) name.textContent = this.state.user.name;
      if (handle) handle.textContent = `@${(this.state.user.name || "user").toLowerCase().replace(/\s+/g, "_")}`;
      if (navBtn) navBtn.textContent = initial;
    }

    const detailName = document.querySelector("#panel-perfil .user-brief-name");
    const detailEmail = document.querySelector("#panel-perfil .user-brief-email");
    const detailRole = document.querySelector("#panel-perfil .user-brief-role");
    const detailAvatar = document.querySelector("#panel-perfil .user-brief-avatar");

    if (detailName && this.state.user) detailName.textContent = this.state.user.name;
    if (detailEmail && this.state.user) detailEmail.textContent = this.state.user.email;
    if (detailRole && this.state.user) detailRole.textContent = this.state.user.role;
    if (detailAvatar && this.state.user) detailAvatar.textContent = (this.state.user.name || "A")[0].toUpperCase();

    const detailsBox = document.querySelector("#panel-perfil .user-brief-details");
    if (detailsBox) {
      const oldMeta = detailsBox.querySelector(".session-meta-box");
      if (oldMeta) oldMeta.remove();
      const metaDiv = document.createElement("div");
      metaDiv.className = "session-meta-box";
      metaDiv.style.marginTop = "10px";
      metaDiv.style.paddingTop = "10px";
      metaDiv.style.borderTop = "1px solid rgba(255,255,255,0.08)";
      metaDiv.style.fontSize = "11px";
      metaDiv.style.color = "rgba(255,255,255,0.6)";
      metaDiv.innerHTML = `
        <div style="margin-bottom: 4px;"><strong>User ID:</strong> <span style="font-family: monospace; color: #10b981;">${this.state.user.id}</span></div>
        <div style="margin-bottom: 4px;"><strong>Session ID:</strong> <span style="font-family: monospace; color: #38bdf8;">${this.state.sessionId}</span></div>
        <div style="margin-bottom: 4px;"><strong>Conversation ID:</strong> <span style="font-family: monospace; color: #f59e0b;">${this.state.conversationId}</span></div>
      `;
      detailsBox.appendChild(metaDiv);
    }
  }

  setProfileOpen(open) {
    this.state.profileOpen = open;
    const modal = $("#userProfileModal");
    const backdrop = $("#userModalBackdrop");
    const btn = $("#profileDropdownBtn");

    if (modal) {
      modal.classList.toggle("hidden", !open);
      modal.setAttribute("aria-hidden", String(!open));
    }
    if (backdrop) {
      backdrop.classList.toggle("hidden", !open);
    }
    if (btn) {
      btn.setAttribute("aria-expanded", String(open));
    }
    if (open) {
      this.updateProfileUI();
    }
  }

  toggleProfile() {
    this.setProfileOpen(!this.state.profileOpen);
  }

  setHelpOpen(open) {
    this.state.helpOpen = open;
    const popover = $('[data-ui="helpPopover"]');
    const toggle = $('[data-action="toggleHelp"]');

    if (popover) {
      popover.classList.toggle("hidden", !open);
      popover.setAttribute("aria-hidden", String(!open));
    }
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
    }
  }

  toggleHelp() {
    this.setHelpOpen(!this.state.helpOpen);
  }

  openApiStatusModal(open = true) {
    const backdrop = $("#apiModalBackdrop");
    if (!backdrop) return;
    if (open) {
      backdrop.classList.remove("hidden");
      fetchApiStatus().then(data => this.updateApiStatusUI(data)).catch(() => {});
    } else {
      backdrop.classList.add("hidden");
    }
  }

  updateApiStatusUI(data) {
    const geminiDot = $("#geminiStatusDot");
    const geminiText = $("#geminiStatusText");
    const atlasDot = $("#atlasStatusDot");
    const atlasText = $("#atlasStatusText");
    const alertBox = $("#apiAlertBox");

    if (geminiDot && geminiText) {
      if (data?.gemini?.connected) {
        geminiDot.className = "api-dot api-dot--ok";
        geminiText.textContent = "Conectado";
      } else {
        geminiDot.className = "api-dot api-dot--error";
        geminiText.textContent = data?.gemini?.error || "Desconectado";
      }
    }

    if (atlasDot && atlasText) {
      if (data?.atlas?.connected) {
        atlasDot.className = "api-dot api-dot--ok";
        atlasText.textContent = "Conectado";
      } else {
        atlasDot.className = "api-dot api-dot--warn";
        atlasText.textContent = data?.atlas?.message || "Não configurado";
      }
    }

    if (alertBox) {
      if (!data?.gemini?.connected) {
        alertBox.classList.remove("hidden");
        alertBox.innerHTML = `<strong>Aviso:</strong> A API Gemini está usando fallback inteligente estruturado.`;
      } else {
        alertBox.classList.add("hidden");
      }
    }
  }

  updatePromptBtnState() {
    const btn = $("#viewPromptBtn");
    if (!btn) return;
    const hasPrompt = Boolean(this.state.lastGeneratedPrompt && this.state.lastGeneratedPrompt.prompt);
    btn.classList.toggle("has-prompt", hasPrompt);
    if (hasPrompt) {
      btn.setAttribute("title", "Ver Prompt Final (Atlas Cloud) — Prompt Ativo!");
    } else {
      btn.setAttribute("title", "Ver Prompt Final (Atlas Cloud)");
    }
  }

  async openPromptModal(open = true) {
    const backdrop = $("#promptModalBackdrop");
    if (!backdrop) return;
    if (open) {
      backdrop.classList.remove("hidden");
      this.renderPromptModalContent();
      const serverData = await fetchLastPrompt(this.state.conversationId, this.state.user?.id);
      if (serverData && serverData.prompt) {
        this.state.lastGeneratedPrompt = serverData;
        this.renderPromptModalContent();
      }
    } else {
      backdrop.classList.add("hidden");
    }
  }

  renderPromptModalContent() {
    const body = $("#promptModalBody");
    if (!body) return;

    if (!this.state.lastGeneratedPrompt || !this.state.lastGeneratedPrompt.prompt) {
      body.innerHTML = `
        <div class="prompt-modal__empty">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>Nenhum Prompt Gerado Ainda</h3>
          <p>Converse com o Dr. Miau e confirme a criação da animação 3D para ver a síntese do prompt aqui.</p>
        </div>
      `;
      return;
    }

    const { prompt, timestamp, jobId, status } = this.state.lastGeneratedPrompt;
    body.innerHTML = `
      <div class="prompt-modal__card">
        <div class="prompt-modal__meta">
          <span><strong>Job ID:</strong> ${jobId || "N/A"}</span>
          <span><strong>Status:</strong> ${status || "Pronto"}</span>
          <span><strong>Horário:</strong> ${timestamp ? new Date(timestamp).toLocaleTimeString() : "Agora"}</span>
        </div>
        <textarea class="prompt-modal__text" readonly>${prompt}</textarea>
        <button id="copyPromptBtn" class="modal-btn modal-btn--confirm" style="margin-top: 12px; width: 100%;">
          Copiar Prompt Completo
        </button>
      </div>
    `;

    const copyBtn = $("#copyPromptBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(prompt).then(() => {
          copyBtn.textContent = "✔ Copiado!";
          setTimeout(() => { copyBtn.textContent = "Copiar Prompt Completo"; }, 2000);
        });
      });
    }
  }
}

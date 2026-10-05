/**
 * Componente de Animações do Dr. Miau e Player de Vídeo 3D
 * Gerencia o dual-buffer de vídeo sem cintilação (A/B), alternância emocional e modal de exibição.
 */

import { $, $$ } from "../utils/dom.js";
import { ANIMATION_POOL, getRandomVideoForEmotion } from "../state/store.js";
import { GalleryManager } from "./modal.component.js";

export class VideoComponent {
  constructor({ state, onVideoModalClosed }) {
    this.state = state;
    this.onVideoModalClosed = onVideoModalClosed;

    this.videoA = $("#magic-hour-video-a");
    this.videoB = $("#magic-hour-video-b");
    this.fallbackImg = $("#dr-miau-img");

    this.state.activeVideo = this.videoA;
    this.state.inactiveVideo = this.videoB;

    this.initEventListeners();
  }

  initEventListeners() {
    [this.videoA, this.videoB].forEach(vid => {
      if (vid) {
        vid.addEventListener("ended", () => this.handleVideoEnded());
      }
    });

    const closeBtn = $("#closeVideoModalBtn");
    const closeFooterBtn = $("#closeVideoModalFooterBtn");
    if (closeBtn) closeBtn.addEventListener("click", () => this.closeVideoModal());
    if (closeFooterBtn) closeFooterBtn.addEventListener("click", () => this.closeVideoModal());
  }

  preloadAllVideos() {
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
      fetch(url, { cache: "force-cache" }).catch(() => {});
    });
  }

  transitionToVideo(videoUrl) {
    if (!this.state.activeVideo) {
      this.state.activeVideo = this.videoA;
      this.state.inactiveVideo = this.videoB;
    }

    const currentActive = this.state.activeVideo;
    const currentInactive = this.state.inactiveVideo;

    if (!currentActive || !currentInactive) return;

    currentInactive.onerror = () => {
      console.warn(`[Video Transition] Vídeo ${videoUrl} não pôde ser reproduzido. Ativando imagem de fallback.`);
      if (this.fallbackImg) this.fallbackImg.classList.remove("hidden");
    };

    currentInactive.src = videoUrl;
    currentInactive.loop = false;
    currentInactive.currentTime = 0;

    let transitioned = false;

    const performSwitch = () => {
      if (transitioned) return;
      transitioned = true;

      currentInactive.classList.remove("hidden");
      currentActive.classList.add("hidden");
      if (this.fallbackImg) this.fallbackImg.classList.add("hidden");

      this.state.activeVideo = currentInactive;
      this.state.inactiveVideo = currentActive;

      currentInactive.onplaying = null;
      currentInactive.onseeked = null;
      currentInactive.oncanplay = null;

      try {
        currentActive.pause();
      } catch (e) {}
    };

    try {
      currentInactive.muted = true;
      currentInactive.defaultMuted = true;
      currentInactive.volume = 0;
      currentInactive.load();

      currentInactive.onplaying = () => performSwitch();

      currentInactive.oncanplay = () => {
        currentInactive.muted = true;
        currentInactive.defaultMuted = true;
        currentInactive.volume = 0;
        currentInactive.play().then(performSwitch).catch(() => performSwitch());
      };

      currentInactive.play().then(performSwitch).catch(() => {});
    } catch (err) {
      performSwitch();
    }
  }

  playEmotionalVideo(videoUrl) {
    this.state.currentEmotionalVideo = videoUrl;
    this.state.alternationStep = 0;
    this.state.alternationPlayCount = 1;
    this.state.videoPlayCount = 1;
    this.transitionToVideo(videoUrl);
  }

  handleVideoEnded() {
    if (!this.state.activeVideo) return;
    const emotionalVideo = this.state.currentEmotionalVideo || getRandomVideoForEmotion("bem_vindo");

    if (this.state.alternationStep === 0) {
      this.state.alternationStep = 1;
      this.state.alternationPlayCount = 1;
      this.transitionToVideo(getRandomVideoForEmotion("normal"));
    } else if (this.state.alternationStep === 1) {
      if (this.state.alternationPlayCount < 3) {
        this.state.alternationPlayCount++;
        this.transitionToVideo(getRandomVideoForEmotion("normal"));
      } else {
        this.state.alternationStep = 2;
        this.state.alternationPlayCount = 1;
        this.transitionToVideo(emotionalVideo);
      }
    } else if (this.state.alternationStep === 2) {
      this.state.alternationStep = 3;
      this.state.alternationPlayCount = 1;
      this.transitionToVideo(getRandomVideoForEmotion("normal"));
    } else if (this.state.alternationStep === 3) {
      this.state.alternationStep = 4;
      this.state.alternationPlayCount = 1;
      this.transitionToVideo(emotionalVideo);
    } else if (this.state.alternationStep === 4) {
      if (this.state.alternationPlayCount < 3) {
        this.state.alternationPlayCount++;
        this.transitionToVideo(emotionalVideo);
      } else {
        this.state.alternationStep = 1;
        this.state.alternationPlayCount = 1;
        this.transitionToVideo(getRandomVideoForEmotion("normal"));
      }
    }
  }

  openVideoModal(videoUrl) {
    const modal = document.getElementById("videoModalBackdrop");
    const videoPlayer = document.getElementById("modalVideoPlayer");
    const downloadBtn = document.getElementById("downloadVideoBtn");

    if (!modal || !videoPlayer || !downloadBtn) return;

    GalleryManager.save(
      videoUrl,
      this.state.lastGeneratedPrompt?.prompt || "Animação 3D 720p gerada pela Atlas Cloud",
      this.state.petProfile?.name || "Pet Especial"
    );

    let triedProxy = false;
    videoPlayer.onerror = () => {
      if (!triedProxy && videoUrl && videoUrl.startsWith("http") && !videoUrl.includes("/api/proxy-video")) {
        triedProxy = true;
        const proxiedUrl = `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`;
        videoPlayer.src = proxiedUrl;
        downloadBtn.href = proxiedUrl;
        try {
          videoPlayer.load();
          videoPlayer.play().catch(() => {});
        } catch (err) {}
      }
    };

    videoPlayer.src = videoUrl;
    downloadBtn.href = videoUrl;
    modal.classList.remove("hidden");

    try {
      videoPlayer.load();
      videoPlayer.play().catch(() => {});
    } catch (err) {}
  }

  closeVideoModal() {
    const modal = document.getElementById("videoModalBackdrop");
    const videoPlayer = document.getElementById("modalVideoPlayer");

    if (!modal || !videoPlayer) return;

    try {
      videoPlayer.pause();
      videoPlayer.src = "";
    } catch (e) {}

    modal.classList.add("hidden");

    if (this.onVideoModalClosed) {
      this.onVideoModalClosed();
    }
  }
}

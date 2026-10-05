/**
 * Componente de Progresso da Jornada e Status de Renderização de Vídeo 3D
 */

import { $ } from "../utils/dom.js";

export class ProgressComponent {
  constructor({ state }) {
    this.state = state;
    this.progressBar = $('[data-ui="progressBar"]');
    this.banner = document.getElementById("videoProgressBanner");
    this.percentEl = document.getElementById("videoProgressPercent");
    this.descEl = document.getElementById("videoProgressDesc");
    this.fillEl = document.getElementById("videoProgressBarFill");
    this.timeEl = document.getElementById("videoProgressTime");
  }

  setProgress(value) {
    const clamped = Math.max(0, Math.min(100, Number(value) || 0));
    this.state.progress = clamped;
    if (this.progressBar) {
      this.progressBar.style.width = `${clamped}%`;
      this.progressBar.setAttribute("aria-valuenow", String(clamped));
    }
  }

  advanceProgress(amount) {
    this.setProgress(this.state.progress + amount);
  }

  updateVideoProgress(percent, desc, showBanner = true, elapsedSec = null, details = null) {
    if (!this.banner) return;

    if (showBanner) {
      this.banner.classList.remove("hidden");
      const p = Math.min(100, Math.max(0, Math.round(percent)));
      if (this.percentEl) this.percentEl.textContent = `${p}%`;
      if (this.descEl) this.descEl.textContent = desc || "Sintetizando animação 3D na Atlas Cloud...";
      if (this.fillEl) this.fillEl.style.width = `${p}%`;
      if (this.timeEl && elapsedSec !== null) {
        const extraInfo = details?.workerStage ? ` • ${details.workerStage}` : "";
        this.timeEl.textContent = `⏱️ ${elapsedSec}s${extraInfo}`;
        this.timeEl.title = details?.jobId ? `Job ID: ${details.jobId} | Status: ${details.status}` : "";
      }
    } else {
      this.banner.classList.add("hidden");
    }
  }

  calculateRealTimeProgress(statusData, elapsedSec, pollTicks) {
    const status = (statusData?.status || "").toLowerCase();
    const outputs = Array.isArray(statusData?.outputs) ? statusData.outputs : [];
    const rawVideoUrl = statusData?.download_url || statusData?.video_url || (outputs.length > 0 ? outputs[0] : null);
    const metrics = statusData?.metrics || {};

    const isValidVideoUrl = Boolean(
      rawVideoUrl &&
      typeof rawVideoUrl === "string" &&
      rawVideoUrl.trim().length > 10 &&
      (rawVideoUrl.startsWith("http://") || rawVideoUrl.startsWith("https://") || rawVideoUrl.startsWith("/api/proxy-video"))
    );

    const videoUrl = isValidVideoUrl ? rawVideoUrl.trim() : null;
    const isCompleted = (status === "completed" || status === "succeeded" || status === "complete") && Boolean(videoUrl);
    const isFailed = status === "failed" || status === "error" || status === "canceled" || status === "timeout";

    if (isCompleted && videoUrl) {
      return {
        percent: 100,
        desc: "✔ Animação 3D concluída com sucesso! Abrindo reprodutor...",
        isCompleted: true,
        isFailed: false,
        workerStage: "Concluído",
        videoUrl,
        error: null
      };
    }

    if (isFailed) {
      const errorMsg = statusData?.error || (status === "timeout" ? "Tempo limite de resposta na Atlas Cloud" : "Falha na renderização de vídeo");
      return {
        percent: 0,
        desc: `❌ Falha: ${errorMsg}`,
        isCompleted: false,
        isFailed: true,
        workerStage: "Falha",
        videoUrl: null,
        error: errorMsg
      };
    }

    const executionTime = metrics.executionTime || 0;
    const inferenceTime = metrics.inferenceTime || 0;
    let workerStage = metrics.workerStage || "Processando";
    let percent = 10;
    let desc = "Sintetizando animação 3D na Atlas Cloud...";

    if (executionTime > 0 || inferenceTime > 0) {
      workerStage = "Inferência GPU Ativa";
      const execSec = Math.max(1, Math.round(executionTime / 1000));
      percent = Math.min(98, Math.round(55 + (execSec / 45) * 40));
      desc = `🔥 Inferência GPU em andamento (${execSec}s de processamento no cluster)...`;
    } else {
      if (elapsedSec <= 6) {
        percent = Math.round(10 + (elapsedSec / 6) * 15);
        desc = "Alocando container GPU na Atlas Cloud...";
        workerStage = "Inicialização";
      } else if (elapsedSec <= 22) {
        percent = Math.round(25 + ((elapsedSec - 6) / 16) * 25);
        desc = "Condicionando imagem e modelo Seedance 2.0...";
        workerStage = "Carregando Modelo";
      } else if (elapsedSec <= 60) {
        percent = Math.round(50 + ((elapsedSec - 22) / 38) * 25);
        desc = `Renderizando 15s em 720p na GPU Atlas Cloud (${elapsedSec}s)...`;
        workerStage = "Renderizando 720p";
      } else if (elapsedSec <= 120) {
        percent = Math.round(75 + ((elapsedSec - 60) / 60) * 15);
        desc = `Pós-processamento e áudio sincronizado (${elapsedSec}s)...`;
        workerStage = "Pós-produção";
      } else {
        const dynamicDelta = elapsedSec - 120;
        const continuousProgress = 90 + 9 * (1 - Math.exp(-dynamicDelta / 160));
        percent = Math.min(99, Math.max(90, Math.round(continuousProgress)));
        desc = `⏳ Renderização 720p na Atlas Cloud (${elapsedSec}s) • Quase pronto...`;
        workerStage = "Finalizando";
      }
    }

    return {
      percent,
      desc,
      isCompleted: false,
      isFailed: false,
      workerStage,
      videoUrl: null,
      error: null
    };
  }
}

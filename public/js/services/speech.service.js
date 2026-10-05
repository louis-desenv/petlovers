/**
 * Serviço de Reconhecimento de Voz (Web Speech API)
 */

export function supportsSpeech() {
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export class SpeechService {
  constructor({ onResult, onError, onStart, onEnd }) {
    this.onResult = onResult;
    this.onError = onError;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.activeRecognition = null;
    this.watchdogTimer = null;
  }

  isListening() {
    return !!this.activeRecognition;
  }

  start() {
    if (!supportsSpeech()) {
      throw new Error("SPEECH_NOT_SUPPORTED");
    }

    this.stop();

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Recognition();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    this.activeRecognition = rec;

    rec.onresult = (event) => {
      const text = event?.results?.[0]?.[0]?.transcript ?? "";
      if (this.onResult) this.onResult(text);
    };

    rec.onerror = (event) => {
      const errorType = event?.error;
      this.stop();
      if (this.onError) this.onError(errorType);
    };

    rec.onend = () => {
      this.stop();
      if (this.onEnd) this.onEnd();
    };

    this.watchdogTimer = setTimeout(() => {
      if (this.activeRecognition === rec) {
        this.stop();
      }
    }, 6500);

    try {
      rec.start();
      if (this.onStart) this.onStart();
    } catch (e) {
      this.stop();
      throw e;
    }
  }

  stop() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch (e) {}
      this.activeRecognition = null;
    }
  }
}

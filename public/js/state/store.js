/**
 * Gerenciamento de Estado Global, Identidade e Persistência Isolada
 */

import { uid } from "../utils/dom.js";

export const INITIAL_MESSAGE =
  "Olá! Sou o Dr. Miau. Estou aqui para ajudar você a criar uma cena 3D personalizada com o seu pet. Para começarmos, qual é o nome do seu companheiro e que tipo de animalzinho ele é? 🐾";

export const ANIMATION_POOL = {
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

export function getRandomVideoForEmotion(emotion) {
  const pool = ANIMATION_POOL[emotion] || ANIMATION_POOL["normal"];
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const item of pool) {
    cumulative += item.probability;
    if (rand <= cumulative) {
      return item.url;
    }
  }
  return pool[pool.length - 1].url;
}

export function generateUniqueId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function initUserIdentity() {
  try {
    const savedUser = localStorage.getItem("drMiau_currentUser");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed && parsed.id) return parsed;
    }
  } catch (e) {}

  const defaultUser = {
    id: generateUniqueId("usr_alex"),
    name: "Alexandre Miau",
    email: "alexandre.miau@gmail.com",
    role: "Tutor de Pets"
  };

  try {
    localStorage.setItem("drMiau_currentUser", JSON.stringify(defaultUser));
  } catch (e) {}

  return defaultUser;
}

export function initSessionIdentifiers() {
  let sessionId = sessionStorage.getItem("drMiau_sessionId");
  if (!sessionId) {
    sessionId = generateUniqueId("sess");
    sessionStorage.setItem("drMiau_sessionId", sessionId);
  }

  let conversationId = sessionStorage.getItem("drMiau_conversationId");
  if (!conversationId) {
    conversationId = generateUniqueId("conv");
    sessionStorage.setItem("drMiau_conversationId", conversationId);
  }

  return { sessionId, conversationId };
}

const initialUser = initUserIdentity();
const initialSession = initSessionIdentifiers();

export const state = {
  user: initialUser,
  sessionId: initialSession.sessionId,
  conversationId: initialSession.conversationId,
  mode: "text",
  listening: false,
  activeRecognition: null,
  historyOpen: false,
  helpOpen: false,
  profileOpen: false,
  miniHistoryVisible: true,
  activeHistoryTab: "messages",
  progress: 0,
  currentPhase: 1,
  photoRequested: false,
  photoRefused: false,
  userHasSentPhoto: false,
  selectedImageBase64: null,
  selectedImageMime: "image/jpeg",
  animating: false,
  currentJobId: null,
  generating: false,
  animationCache: [],
  idleAnimationUrl: null,
  videoPlayCount: 1,
  currentEmotionalVideo: "/videos/bem_vindo.mp4",
  alternationStep: 0,
  alternationPlayCount: 1,
  activeVideo: null,
  inactiveVideo: null,
  agent: {
    speaking: false,
    lastFull: INITIAL_MESSAGE
  },
  lastGeneratedPrompt: null,
  lastUserSubmission: null,
  messages: [
    { id: uid(), role: "Agente", text: INITIAL_MESSAGE, ts: Date.now() }
  ]
};

export function getChatStorageKey(userId = state.user?.id, convId = state.conversationId) {
  const uidStr = userId || "usr_anonymous";
  const cidStr = convId || "conv_default";
  return `drMiau_chatState_${uidStr}_${cidStr}`;
}

export function saveStateToCache() {
  try {
    const key = getChatStorageKey();
    const dataToSave = {
      userId: state.user.id,
      sessionId: state.sessionId,
      conversationId: state.conversationId,
      messages: state.messages,
      progress: state.progress,
      currentPhase: state.currentPhase,
      photoRequested: state.photoRequested,
      photoRefused: state.photoRefused,
      userHasSentPhoto: state.userHasSentPhoto,
      lastGeneratedPrompt: state.lastGeneratedPrompt,
      lastUserSubmission: state.lastUserSubmission,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(dataToSave));
    localStorage.setItem(`drMiau_activeConv_${state.user.id}`, state.conversationId);
  } catch (e) {
    console.warn("Não foi possível salvar o estado da conversa em cache:", e);
  }
}

export function loadStateFromCache() {
  try {
    if (localStorage.getItem("drMiau_chatState")) {
      localStorage.removeItem("drMiau_chatState");
    }

    const key = getChatStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.userId === state.user.id && parsed.conversationId === state.conversationId) {
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          state.messages = parsed.messages;
        }
        if (typeof parsed.progress === "number") state.progress = parsed.progress;
        if (typeof parsed.currentPhase === "number") state.currentPhase = parsed.currentPhase;
        if (typeof parsed.photoRequested === "boolean") state.photoRequested = parsed.photoRequested;
        if (typeof parsed.photoRefused === "boolean") state.photoRefused = parsed.photoRefused;
        if (typeof parsed.userHasSentPhoto === "boolean") state.userHasSentPhoto = parsed.userHasSentPhoto;
        if (parsed.lastGeneratedPrompt) state.lastGeneratedPrompt = parsed.lastGeneratedPrompt;
        if (parsed.lastUserSubmission) state.lastUserSubmission = parsed.lastUserSubmission;
        return true;
      }
    }
  } catch (e) {
    console.warn("Não foi possível carregar o cache da conversa:", e);
  }
  return false;
}

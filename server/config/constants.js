const { Type } = require("@google/genai");

// Mensagens padrão e iniciais do agente Dr. Miau
const INITIAL_MESSAGE = "Olá! Sou o Dr. Miau. Estou aqui para ajudar você a criar uma cena 3D personalizada com o seu pet. Para começarmos, qual é o nome do seu companheiro e que tipo de animalzinho ele é? 🐾";
const ALT_INITIAL_MESSAGE = "Olá, eu sou o Dr. Miau, veterinário e apaixonado por todas as espécies do reino animal! 🐾🎬 Tenho uma surpresa especial preparada para o seu pet no final da nossa conversa. Para isso ficar incrível, me conta: qual é o nome dele e que espécie de animalzinho é?";
const OLD_INITIAL_MESSAGE = "Olá! Sou o Dr. Miau! 🐾 Me conta: que tipo de bichinho de estimação você tem? É um gatinho, um cãozinho ou outro amiguinho?";
const OLD_INITIAL_MESSAGE_2 = "Olá! Sou o Dr. Miau, seu agente de pets. Me conta sua ideia!";

// URLs locais dos vídeos pré-renderizados de reações emocionais
const VIDEO_URLS = {
  bem_vindo: "/videos/bemvindo1.mp4",
  normal: "/videos/normal.mp4",
  feliz: "/videos/feliz.mp4",
  triste: "/videos/triste.mp4",
  raiva: "/videos/raiva.mp4",
  confuso: "/videos/confuso1.mp4"
};

// Mapeamento de sentimentos retornados pela IA para os arquivos de vídeo de reação
const SENTIMENT_TO_VIDEO = {
  alegre: "feliz",
  neutro: "normal",
  preocupado: "triste",
  protetor: "raiva",
  confuso: "confuso1"
};

// Definição do schema JSON estruturado para o SDK @google/genai
const RESPONSE_SCHEMA_DEF = {
  type: Type.OBJECT,
  properties: {
    response: {
      type: Type.STRING,
      description: "A resposta do Dr. Miau em português, 100% natural, carinhosa, empática, inteligente e conversacional (2 a 4 frases)."
    },
    sentiment: {
      type: Type.STRING,
      enum: ["alegre", "neutro", "preocupado", "protetor", "confuso"],
      description: "A emoção correspondente do avatar do Dr. Miau para o vídeo de reação."
    },
    phase: {
      type: Type.INTEGER,
      description: "A fase da conversa: 1 (Pet & História), 2 (Cenário), 3 (Ação), 4 (Síntese & Confirmação com o Dono)."
    },
    progress: {
      type: Type.INTEGER,
      description: "O progresso acumulado da jornada de 0 a 100."
    },
    pet_profile: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Nome do pet" },
        species: { type: Type.STRING, description: "Espécie (cão, gato, ave, peixe, etc.)" },
        appearance: { type: Type.STRING, description: "Cores, pelagem, marcas e características físicas" },
        emotional_story: { type: Type.STRING, description: "História afetiva do tutor com o animal" },
        scenario: { type: Type.STRING, description: "Cenário dos sonhos imaginado" },
        action: { type: Type.STRING, description: "Ação que o pet executa na cena" }
      },
      description: "Dados estruturados do pet acumulados ao longo da conversa."
    },
    photo_requested: {
      type: Type.BOOLEAN,
      description: "Defina como true se o Dr. Miau acabou de convidar o envio da foto do pet."
    },
    ready_for_confirmation: {
      type: Type.BOOLEAN,
      description: "Defina como true quando os 3 pilares estiverem reunidos e o Dr. Miau apresentar a sinopse para aprovação do tutor."
    },
    trigger_video_generation: {
      type: Type.BOOLEAN,
      description: "Defina como true apenas quando o tutor confirmar a síntese e autorizar a renderização 3D na Atlas Cloud."
    },
    video_prompt: {
      type: Type.STRING,
      description: "O prompt sintetizado detalhado em inglês cinematográfico (CinePrompt AI com @image1) para a Atlas Cloud Seedance 2.0, preenchido quando trigger_video_generation for true."
    }
  },
  required: ["response", "sentiment", "phase", "progress", "ready_for_confirmation", "trigger_video_generation", "video_prompt"]
};

// Espécies de animais domésticos para classificação heurística
const BREED_RELEVANT_SPECIES = [
  "cachorro", "cão", "cao", "cadela", "dog", "doguinho",
  "gato", "gata", "felino", "cat", "gatinho", "gatinha",
  "cavalo", "égua", "egua", "potro", "horse"
];

const NON_BREED_SPECIES = [
  "papagaio", "calopsita", "periquito", "canário", "canario", "cacatua", "arara", "pássaro", "passaro", "ave",
  "peixe", "peixinho", "betta", "carpa", "goldfish",
  "hamster", "porquinho da índia", "porquinho da india", "coelho", "coelha", "chinchila", "furão", "furao",
  "tartaruga", "jabuti", "cágado", "cagado", "iguana", "lagarto", "cobra", "serpente"
];

module.exports = {
  INITIAL_MESSAGE,
  ALT_INITIAL_MESSAGE,
  OLD_INITIAL_MESSAGE,
  OLD_INITIAL_MESSAGE_2,
  VIDEO_URLS,
  SENTIMENT_TO_VIDEO,
  RESPONSE_SCHEMA_DEF,
  BREED_RELEVANT_SPECIES,
  NON_BREED_SPECIES
};

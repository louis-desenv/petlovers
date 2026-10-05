/**
 * Serviço de Higienização de Texto, Análise Heurística e CinePrompt AI
 * Fornece normalização de texto, análise de perfil de pet e tradução cinematográfica 3D.
 */

const {
  INITIAL_MESSAGE,
  ALT_INITIAL_MESSAGE,
  OLD_INITIAL_MESSAGE,
  OLD_INITIAL_MESSAGE_2,
  BREED_RELEVANT_SPECIES,
  NON_BREED_SPECIES
} = require("../config/constants");

/**
 * Remove artefatos de encoding e normaliza palavras com caracteres corrompidos em português
 * @param {string} str 
 * @returns {string}
 */
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

/**
 * Constrói a estrutura de mensagens alternadas user/model para a API do Gemini
 * @param {Array} cleanedHistory 
 * @param {string} currentMessage 
 * @param {string|null} currentImage 
 * @returns {Array}
 */
function buildAlternatingContents(cleanedHistory, currentMessage, currentImage = null) {
  const contents = [];

  for (const h of cleanedHistory) {
    if (!h) continue;
    const role = (h.role === "user" || h.role === "User" || h.role === "Voce") ? "user" : "model";
    const parts = [];

    if (h.image || h.imageUrl) {
      const imgData = h.image || h.imageUrl;
      if (typeof imgData === "string" && imgData.includes("base64,")) {
        try {
          const [meta, b64] = imgData.split("base64,");
          const mimeMatch = meta.match(/data:([^;]+);/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          parts.push({
            inlineData: {
              mimeType: mimeType.trim(),
              data: b64.trim()
            }
          });
        } catch (e) {
          console.warn("⚠️ Erro ao preparar inlineData para o histórico:", e.message);
        }
      }
    }

    if (h.text) {
      parts.push({ text: h.text });
    } else if (parts.length === 0) {
      parts.push({ text: "Foto do pet enviada pelo tutor 📸" });
    }

    // Garante alternância estrita entre turnos
    const lastContent = contents[contents.length - 1];
    if (lastContent && lastContent.role === role) {
      lastContent.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  // Turno atual do usuário
  const currentParts = [];
  if (currentImage && typeof currentImage === "string" && currentImage.includes("base64,")) {
    try {
      const [meta, b64] = currentImage.split("base64,");
      const mimeMatch = meta.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      currentParts.push({
        inlineData: {
          mimeType: mimeType.trim(),
          data: b64.trim()
        }
      });
    } catch (e) {
      console.warn("⚠️ Erro ao preparar inlineData do turno atual:", e.message);
    }
  }

  if (currentMessage && currentMessage.trim()) {
    currentParts.push({ text: currentMessage.trim() });
  } else if (currentParts.length === 0) {
    currentParts.push({ text: "Foto do pet enviada pelo tutor 📸" });
  }

  const lastTurn = contents[contents.length - 1];
  if (lastTurn && lastTurn.role === "user") {
    lastTurn.parts.push(...currentParts);
  } else {
    contents.push({ role: "user", parts: currentParts });
  }

  return contents;
}

/**
 * Traduz termos em português para prompts cinematográficos em inglês formatados para o modelo Seedance 2.0
 */
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

  // Mapeamento de cores (Continuity Tokens)
  const colorMap = {
    "vermelho": "radiant ruby red with shimmering highlights",
    "vermelha": "radiant ruby red with shimmering highlights",
    "azul": "vibrant royal blue with glowing tones",
    "amarelo": "bright sunny golden yellow coat",
    "dourado": "shimmering metallic golden coat",
    "preto": "sleek velvety midnight black fur",
    "branco": "pure snowy white fluffy coat",
    "laranja": "warm bright glowing orange coat",
    "caramelo": "warm golden caramel fur",
    "marrom": "rich warm chocolate brown fur",
    "cinza": "soft silver grey coat",
    "rajado": "expressive striped tabby pattern",
    "malhado": "spotted charming coat",
    "tricolor": "colorful three-tone pattern"
  };

  const rawColor = (coatColor || "").toLowerCase().trim();
  let enColor = "vibrant locked physical colors";
  for (const [pt, en] of Object.entries(colorMap)) {
    if (rawColor.includes(pt)) {
      enColor = en;
      break;
    }
  }

  // Mapeamento de cenário (Setting & Context)
  let enScenario = "set in a cozy, sun-drenched living room with soft ambient warmth and gentle dust motes in sunbeams";
  const rawScen = (scenarioText || "").toLowerCase().trim();
  if (rawScen.includes("praia") || rawScen.includes("mar") || rawScen.includes("oceano")) {
    enScenario = "set on a tropical sun-kissed golden sand beach during golden hour with gentle turquoise waves in the background";
  } else if (rawScen.includes("floresta") || rawScen.includes("bosque") || rawScen.includes("árvores")) {
    enScenario = "set inside an enchanted magical fairytale forest with bioluminescent mushrooms and soft volumetric god rays filtering through lush canopy";
  } else if (rawScen.includes("jardim") || rawScen.includes("flores") || rawScen.includes("parque")) {
    enScenario = "set in a lush blooming botanical garden with colorful oversized flowers and fluttering butterflies in warm morning sunlight";
  } else if (rawScen.includes("espaço") || rawScen.includes("espaco") || rawScen.includes("galáxia") || rawScen.includes("estrelas")) {
    enScenario = "set in a breathtaking cosmic space scene with glowing nebula clouds, twinkling distant stars, and weightless atmospheric physics";
  } else if (rawScen.includes("castelo") || rawScen.includes("reino")) {
    enScenario = "set inside a grand fantasy castle hall with royal velvet drapery, warm torchlight, and marble floors";
  } else if (rawScen.includes("cidade") || rawScen.includes("casa") || rawScen.includes("sala")) {
    enScenario = rawType.includes("peixe") 
      ? "set inside a crystal-clear modern sunlit glass aquarium decorated with miniature colorful coral structures and glowing water ripples" 
      : "set inside a warm sunlit Scandinavian living room with soft aesthetic decor and cozy ambient light";
  }

  // Mapeamento de ação (Subject & Action ao longo de 5 segundos)
  let enAction = "performing a joyful 5-second dynamic movement with fluid natural body animation and expressive facial reactions";
  const rawAct = (actionText || "").toLowerCase().trim();
  if (rawType.includes("peixe")) {
    enAction = "swimming gracefully in a smooth 360-degree loop, blowing glowing bubble streams and doing an acrobatic tail spin";
  } else if (rawAct.includes("correr") || rawAct.includes("correndo") || rawAct.includes("brincar")) {
    enAction = "running happily towards the camera in a bouncy rhythm, wagging tail and showing delighted expressive eyes";
  } else if (rawAct.includes("dormir") || rawAct.includes("soneca") || rawAct.includes("deitado")) {
    enAction = "curled up comfortably, taking a sweet peaceful nap with soft rhythmic chest breathing and occasional ear twitches";
  } else if (rawAct.includes("skate") || rawAct.includes("voar") || rawAct.includes("heroi") || rawAct.includes("herói")) {
    enAction = "performing an energetic heroic glide forward with playful confidence, dynamic wind effects, and proud pose";
  }

  const cameraMotion = "Medium eye-level shot, smooth low-angle dolly push tracking shot following the character motion.";
  return `[Subject & Action]: High-end 3D animation featuring ${enPetType} named ${name}, ${enAction} over 5 seconds. [Setting & Context]: ${enScenario}. [Camera Shot & Motion]: ${cameraMotion} [Continuity Tokens]: Physical attributes locked with ${enColor}, maintaining strict anatomical feature consistency without morphing. [Style & Lighting]: 3D Pixar-Disney cinematic style, volumetric rim lighting, Octane render 8k detail, 720p 1:1 square ratio. [Negative Prompt]: Avoid extra limbs, deformed face, character morphing, text, watermarks, chaotic motion, flickering artifacts.`;
}

/**
 * Analisa o histórico de mensagens e extrai as características obrigatórias do pet (Fase 1)
 */
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

  // 1. ESPÉCIE / TIPO DO ANIMAL
  let hasPetType = false;
  let petType = null;
  let isBreedRelevant = true;

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

  // Detecção via menções gerais
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

  let needsDoubleCheckPetType = false;
  if (!hasPetType) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askTypeReg = /(?:que\s+tipo\s+de\s+animalzinho|qual\s+animal|que\s+bichinho|gatinho,\s*cãozinho|espécie)/i;
        const isDoubleCheck = /(?:como\s+assim|tem\s+certeza|você\s+não\s+quer\s+me\s+contar|me\s+conta\s+só)/i.test(turn.text);
        if (askTypeReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().toLowerCase();
          const isNegative = /^(?:n[ãa]o|nao|nenhum|nada|n[ãa]o\s+sei|j[aá]\s+disse)$/i.test(userReply) || userReply === "não" || userReply === "nao";
          if (isDoubleCheck) {
            hasPetType = true;
            petType = "amiguinho fofo";
            needsDoubleCheckPetType = false;
            break;
          } else if (isNegative) {
            if (i + 2 < turns.length) {
              hasPetType = true;
              petType = "amiguinho fofo";
              needsDoubleCheckPetType = false;
              break;
            } else {
              needsDoubleCheckPetType = true;
            }
          }
        }
      }
    }
  }

  // 2. NOME DO ANIMALZINHO
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

  if (!hasPetName) {
    if (/(?:não|nao)\s+(?:tem|escolhi|coloquei|temos)\s+nome|sem\s+nome|ainda\s+(?:não|nao)\s+tem\s+nome/i.test(combinedUserText)) {
      hasPetName = true;
      petName = "sem nome definido ainda";
    }
  }

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

  // 3. RAÇA
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

  // 4. COLORAÇÃO DE PELE OU PELOS
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

  // 5. CARACTERÍSTICA MARCANTE / AVARIAÇÃO
  let hasAvariacao = false;
  let avariacao = null;
  let needsDoubleCheckAvariacao = false;
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
        const isDoubleCheckQuestion = /(?:tem\s+certeza|nenhumazinha|escondid|nem\s+uma\s+manchinha|pontinha)/i.test(turn.text);
        if (askAvariacaoReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().toLowerCase();
          const isNegativeReply = /^(?:n[ãa]o|nao|nenhuma|nada|n[ãa]o\s+tem|sem\s+mancha|n[ãa]o\s+sei|liso|lisinho|j[aá]\s+disse|num\s+tem|certeza)$/i.test(userReply) ||
            userReply.includes("não") || userReply.includes("nao") || userReply.includes("nenhum");
          if (isDoubleCheckQuestion) {
            hasAvariacao = true;
            avariacao = isNegativeReply ? "nenhuma (pelagem lisa/sem marcas)" : userReply;
            needsDoubleCheckAvariacao = false;
            break;
          } else if (isNegativeReply) {
            if (i + 2 < turns.length) {
              hasAvariacao = true;
              avariacao = "nenhuma (pelagem lisa/sem marcas)";
              needsDoubleCheckAvariacao = false;
              break;
            } else {
              needsDoubleCheckAvariacao = true;
            }
          } else {
            hasAvariacao = true;
            avariacao = userReply;
            break;
          }
        }
      }
    }
  }

  // 6. HISTÓRIA DO TUTOR
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
  let needsDoubleCheckPetStory = false;
  if (!hasPetStory) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askStoryReg = /(?:hist[oó]ria|como\s+(?:voc[êe]s\s+)?se\s+conheceram|como\s+ele\s+chegou|dia\s+em\s+que|momento\s+marcante|travessura|como\s+foi\s+quando|adot|resgat)/i;
        const isDoubleCheck = /(?:como\s+assim|tem\s+certeza|você\s+não\s+quer\s+me\s+contar|uma\s+lembrança)/i.test(turn.text);
        if (askStoryReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().toLowerCase();
          const isNegative = /^(?:n[ãa]o|nao|nenhuma|nada|n[ãa]o\s+sei|j[aá]\s+disse|sem\s+hist[oó]ria)$/i.test(userReply) || userReply === "não" || userReply === "nao";
          if (isDoubleCheck) {
            hasPetStory = true;
            petStory = "história cheia de mistério";
            needsDoubleCheckPetStory = false;
            break;
          } else if (isNegative) {
            if (i + 2 < turns.length) {
              hasPetStory = true;
              petStory = "história cheia de mistério";
              needsDoubleCheckPetStory = false;
              break;
            } else {
              needsDoubleCheckPetStory = true;
            }
          } else if (userReply.length >= 2) {
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
  const checklistText = `- 1. Nome do animal: ${hasPetName ? `✅ CONHECIDO ("${petName}")` : "❌ PENDENTE (Perguntar o nome do animalzinho)"}
- 2. Tipo do animal: ${hasPetType ? `✅ CONHECIDO ("${petType}")` : "❌ PENDENTE (Perguntar qual é o animal: gato, cachorro, elefante...)"}
- 3. História do tutor com o pet: ${hasPetStory ? `✅ CONHECIDA ("${petStory}")` : "❌ PENDENTE (Perguntar como se conheceram, como foi a chegada dele ou momentos marcantes)"}
- 4. Raça: ${!isBreedRelevant ? "➖ NÃO SE APLICA (animal sem raças conhecidas)" : hasBreed ? `✅ CONHECIDO ("${petBreed}")` : "❌ PENDENTE (Perguntar a raça ou se é vira-lata)"}
- 5. Coloração da pele, pelagem ou plumagem: ${hasCoatColor ? `✅ CONHECIDO ("${coatColor}")` : "❌ PENDENTE (Perguntar a cor da pele ou pelos)"}
- 6. Variação ou característica marcante: ${hasAvariacao ? `✅ CONHECIDO ("${avariacao}")` : "❌ PENDENTE (Perguntar se possui manchas, deficiência, cicatriz ou se é sem marcas especiais)"}`.trim();

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
    needsDoubleCheckAvariacao,
    needsDoubleCheckPetType,
    needsDoubleCheckPetStory,
    hasPetStory,
    petStory,
    missingParams,
    isPhase1Complete,
    checklistText
  };
}

/**
 * Avalia o estado geral da conversa (Fases 1, 2, 3 e 4)
 */
function evaluateConversationState(history = [], currentMessage = "", sessionState = null) {
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

  const petProfile = analyzePetProfile(history, currentMessage);
  const hasPetDetails = petProfile.isPhase1Complete;

  const userTextsClean = userTexts.map(text => {
    return text
      .replace(/\[imagem analisada pelo agente de visão[^]*?\]:[^]*?(\n\ncomentário do usuário:|$)/gi, " ")
      .replace(/\[foto do pet enviada pelo tutor[^]*?\]:[^]*?(\n\ncomentário do usuário:|$)/gi, " ");
  });
  const combinedUserTextClean = userTextsClean.join(" ");

  let hasScenarioDetails = false;
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

  const explicitScenarioKeywords = [
    "praia", "floresta", "espaço", "espaco", "castelo", "nuvens", "mar", "montanha",
    "parte 2 - o cenário", "universo", "lua", "planeta", "neve", "piscina", "mundo de doces",
    "campo verde", "mato alto", "reino", "na praia", "na floresta", "no espaço", "no castelo",
    "no jardim", "no cenario", "no cenário", "cenário de", "cenario de", "fundo de", "galáxia", "nave"
  ];

  let assistantAskedScenario = false;
  for (let i = 0; i < turns.length - 1; i++) {
    const t = turns[i];
    const next = turns[i + 1];
    if (t.role === "assistant" && next.role === "user") {
      if (/(?:cen[aá]rio|lugar|ambiente|onde\s+(?:voc[êe]\s+)?gostaria|em\s+qual\s+(?:lugar|cen[aá]rio)|fase\s+2)/i.test(t.text)) {
        assistantAskedScenario = true;
        if (next.text && next.text.trim().length >= 2) {
          hasScenarioDetails = true;
          break;
        }
      }
    }
  }

  if (hasPetDetails || assistantAskedScenario) {
    if (!hasScenarioDetails && explicitScenarioKeywords.some(kw => combinedUserTextClean.includes(kw))) {
      hasScenarioDetails = true;
    }
    if (!hasScenarioDetails && hasPetDetails) {
      const genericScenarioKeywords = ["sala", "quarto", "cozinha", "parque", "quintal", "rua", "casa", "lago", "rio", "fazenda", "céu", "ceu"];
      const lastUserTurn = turns.filter(t => t.role === "user").pop();
      if (lastUserTurn && genericScenarioKeywords.some(kw => lastUserTurn.text.toLowerCase().includes(kw)) && assistantAskedScenario) {
        hasScenarioDetails = true;
      }
    }
  }

  let hasActionDetails = false;
  if (hasPetDetails && hasScenarioDetails) {
    for (let i = 0; i < turns.length - 1; i++) {
      const t = turns[i];
      const next = turns[i + 1];
      if (t.role === "assistant" && next.role === "user") {
        if (/(?:qual\s+a[çc][ãa]o|a[çc][ãa]o\s+voc[êe]\s+gostaria|fazendo\s+no\s+v[íi]deo|o\s+que\s+gostaria\s+de\s+ver|qualquer\s+a[çc][ãa]o|o\s+que\s+ele\s+vai\s+fazer|que\s+a[çc][ãa]o|fazendo\s+o\s+que)/i.test(t.text)) {
          if (next.text && next.text.trim().length >= 2) {
            hasActionDetails = true;
            break;
          }
        }
      }
    }
    const actionKeywords = [
      "dormindo", "dormir", "correr", "correndo", "pular", "pulando", "voar", "voando",
      "skate", "andando de skate", "brincar", "brincando", "dançar", "dancar", "dançando",
      "nadar", "nadando", "caçar", "caçando", "faz o vídeo", "faz o video", "gera o vídeo", "gera o video"
    ];
    if (!hasActionDetails && actionKeywords.some(kw => combinedUserTextClean.includes(kw))) {
      hasActionDetails = true;
    }
    if (!hasActionDetails && currentMessage && currentMessage.trim().length >= 2) {
      const lastAssistantTurn = turns.filter(t => t.role === "assistant").pop();
      if (lastAssistantTurn && /(?:a[çc][ãa]o|fazendo|fazer|vídeo|video)/i.test(lastAssistantTurn.text)) {
        hasActionDetails = true;
      }
    }
  }

  const totalUserTurns = userTexts.length;
  let maxAllowedPhase = 1;
  let suggestedProgress = 10;
  let canTriggerVideo = false;

  if (!hasPetDetails) {
    maxAllowedPhase = 1;
    let completedCount = 0;
    if (petProfile.hasPetType) completedCount++;
    if (petProfile.hasPetName) completedCount++;
    if (petProfile.hasBreed) completedCount++;
    if (petProfile.hasCoatColor) completedCount++;
    if (petProfile.hasAvariacao) completedCount++;
    suggestedProgress = 5 + (completedCount * 6);
    canTriggerVideo = false;
    hasScenarioDetails = false;
    hasActionDetails = false;
  } else if (!hasScenarioDetails) {
    maxAllowedPhase = 2;
    suggestedProgress = 55;
    canTriggerVideo = false;
    hasActionDetails = false;
  } else if (!hasActionDetails) {
    maxAllowedPhase = 3;
    suggestedProgress = 80;
    canTriggerVideo = false;
  } else {
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

module.exports = {
  cleanPortugueseText,
  buildAlternatingContents,
  translateToEnglishCinematicTerms,
  analyzePetProfile,
  evaluateConversationState
};

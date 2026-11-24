import { CEFRLevel } from '../types';
import { analyzeTextWithRules } from './aiService';

export interface AiCoachResponsePayload {
  replyText: string;
  suggestions: string[];
  modeUsed?: 'gemini' | 'linguistic-engine';
}

interface PhraseTranslationEntry {
  english: string;
  translations: Record<string, { phrase: string; pronunciation?: string; note: string }>;
}

const PHRASE_DICTIONARY: PhraseTranslationEntry[] = [
  {
    english: 'hello',
    translations: {
      German: { phrase: 'Hallo! / Guten Tag!', pronunciation: 'HAH-loh / GOO-ten tahk', note: 'Use "Hallo" casually and "Guten Tag" in polite or formal settings.' },
      Spanish: { phrase: '¡Hola! / ¡Buenos días!', pronunciation: 'OH-lah / BWEH-nohs DEE-ahs', note: '"¡Hola!" works anytime; "¡Buenos días!" is used until afternoon.' },
      French: { phrase: 'Bonjour ! / Salut !', pronunciation: 'bohn-ZHOOR / sah-LU', note: '"Bonjour" is polite and universal; "Salut" is for friends.' },
      Italian: { phrase: 'Ciao! / Buongiorno!', pronunciation: 'CHOW / bwohn-JOR-noh', note: 'Use "Buongiorno" with strangers or in shops, and "Ciao" with friends.' },
      Japanese: { phrase: 'こんにちは (Konnichiwa)', pronunciation: 'kohn-nee-chee-wah', note: 'Standard daytime greeting; use おはようございます (Ohayō gozaimasu) in the morning.' },
      Mandarin: { phrase: '你好 (Nǐ hǎo) / 您好 (Nín hǎo)', pronunciation: 'nee how / neen how', note: 'Use 您好 (Nín hǎo) to show polite respect.' },
      Portuguese: { phrase: 'Olá! / Bom dia!', pronunciation: 'oh-LAH / bohm JEE-ah', note: 'Natural everyday greeting across Portugal and Brazil.' }
    }
  },
  {
    english: 'how are you',
    translations: {
      German: { phrase: 'Wie geht es dir? (informal) / Wie geht es Ihnen? (formal)', note: 'Reply with "Mir geht es gut, danke!" (never "Ich bin gut").' },
      Spanish: { phrase: '¿Cómo estás? / ¿Qué tal?', note: 'Reply with "¡Muy bien, gracias! ¿Y tú?"' },
      French: { phrase: 'Comment ça va ? / Comment allez-vous ?', note: '"Comment allez-vous ?" is formal; "Ça va ?" is relaxed.' },
      Italian: { phrase: 'Come stai? (informal) / Come sta? (formal)', note: 'Reply with "Bene, grazie! E tu?"' },
      Japanese: { phrase: 'お元気ですか？ (O-genki desu ka?)', note: 'In casual daily check-ins, 調子はどう？ (Chōshi wa dō?) also sounds very natural.' },
      Mandarin: { phrase: '你好吗？ (Nǐ hǎo ma?) / 最近怎么样？ (Zuìjìn zěnmeyàng?)', note: '最近怎么样 ("How have things been lately?") sounds especially authentic.' },
      Portuguese: { phrase: 'Tudo bem? / Como você está?', note: 'People often both ask and answer with "Tudo bem!"' }
    }
  },
  {
    english: 'thank you',
    translations: {
      German: { phrase: 'Danke schön! / Vielen Dank!', note: '"Vielen Dank" adds warm appreciation.' },
      Spanish: { phrase: '¡Muchas gracias! / Te lo agradezco mucho.', note: '"Te lo agradezco" sounds polished at B1–C1 level.' },
      French: { phrase: 'Merci beaucoup ! / Je vous remercie.', note: '"Je vous remercie" is polite and elevated.' },
      Italian: { phrase: 'Grazie mille! / Ti ringrazio.', note: 'Never say "Grazie tante" sarcastically—stick to "Grazie mille!"' },
      Japanese: { phrase: 'ありがとうございます (Arigatō gozaimasu)', note: 'Add ございました (gozaimashita) when thanking someone for something already completed.' },
      Mandarin: { phrase: '谢谢你 (Xièxie nǐ) / 非常感谢 (Fēicháng gǎnxiè)', note: '非常感谢 means "Thank you very much".' },
      Portuguese: { phrase: 'Muito obrigado (m.) / Muito obrigada (f.)', note: 'Match the ending (-o / -a) to your own gender.' }
    }
  },
  {
    english: 'where is the train station',
    translations: {
      German: { phrase: 'Entschuldigung, wo ist der Bahnhof?', note: '"Bahnhof" is masculine (der Bahnhof). To ask how to get there: "Wie komme ich zum Bahnhof?"' },
      Spanish: { phrase: 'Disculpe, ¿dónde está la estación de tren?', note: 'Use "está" (from estar) for physical locations!' },
      French: { phrase: 'Excusez-moi, où se trouve la gare ?', note: '"Où se trouve..." sounds slightly more polite than "Où est...".' },
      Italian: { phrase: 'Mi scusi, dov’è la stazione dei treni?', note: '"Dove + è" contracts naturally to "dov’è".' },
      Japanese: { phrase: 'すみません、駅はどこですか？ (Sumimasen, eki wa doko desu ka?)', note: '駅 (eki) means train station; すみません politely gets attention.' },
      Mandarin: { phrase: '请问，火车站在哪里？ (Qǐngwèn, huǒchēzhàn zài nǎlǐ?)', note: '请问 ("May I ask") makes any direction question polite.' },
      Portuguese: { phrase: 'Com licença, onde fica a estação de trem / comboio?', note: 'Brazil uses "trem"; Portugal uses "comboio".' }
    }
  },
  {
    english: 'i have been waiting for two hours',
    translations: {
      German: { phrase: 'Ich warte schon seit zwei Stunden.', note: 'German uses Präsens + "seit" (+ Dative) for actions that started in the past and continue right now!' },
      Spanish: { phrase: 'Llevo dos horas esperando. / Hace dos horas que espero.', note: '"Llevar + time + gerundio" is the most idiomatic way to express ongoing duration.' },
      French: { phrase: 'J’attends depuis deux heures.', note: 'French uses the present tense + "depuis" for actions still in progress.' },
      Italian: { phrase: 'Aspetto da due ore.', note: 'Italian uses Presente + "da" to express "have been doing for...".' },
      Japanese: { phrase: '2時間待っています (Ni-jikan matte imasu).', note: 'Use the 〜ています (-te imasu) continuous state form.' },
      Mandarin: { phrase: '我已经等了两个小时了 (Wǒ yǐjīng děng le liǎng gè xiǎoshí le).', note: 'Double 了 marks an action that has lasted up to now and is still ongoing.' },
      Portuguese: { phrase: 'Estou esperando há duas horas.', note: 'Use "há" to indicate elapsed time up to the present.' }
    }
  },
  {
    english: 'nice to meet you',
    translations: {
      German: { phrase: 'Freut mich, dich kennenzulernen! (informal) / Sehr erfreut! (formal)', note: 'Shorten to "Freut mich!" in casual introductions.' },
      Spanish: { phrase: '¡Mucho gusto! / Encantado(a) de conocerte.', note: '"Mucho gusto" is invariable and works everywhere.' },
      French: { phrase: 'Enchanté(e) de faire votre connaissance !', note: 'In everyday conversation, simply "Enchanté !" is crisp and natural.' },
      Italian: { phrase: 'Piacere di conoscerti! / Molto lieto!', note: '"Piacere!" is the universal go-to.' },
      Japanese: { phrase: 'はじめまして。よろしくお願いします。(Hajimemashite. Yoroshiku onegaishimasu.)', note: 'Said when meeting someone for the very first time.' },
      Mandarin: { phrase: '很高兴认识你 (Hěn gāoxìng rènshi nǐ).', note: 'Literally "Very happy to know you".' },
      Portuguese: { phrase: 'Muito prazer em conhecê-lo(a)! / Prazer!', note: '"Muito prazer!" works in all social situations.' }
    }
  }
];

const GRAMMAR_TOPIC_GUIDES: Array<{
  keywords: RegExp;
  title: string;
  answer: (targetLanguage: string) => string;
}> = [
  {
    keywords: /\b(ser\s+vs\.?\s+estar|ser\s+and\s+estar|difference.*ser.*estar)\b/i,
    title: 'Ser vs. Estar in Spanish',
    answer: () =>
      `**Ser vs. Estar** comes down to **Essence (Identity) vs. State/Condition**:\n` +
      `• **Ser** (DOCTOR: Description, Occupation, Characteristic, Time, Origin, Relationship) -> *"Soy ingeniero"* (I am an engineer), *"Ella es de Madrid"*.\n` +
      `• **Estar** (PLACE: Position, Location, Action, Condition, Emotion) -> *"Estoy cansado hoy"* (I feel tired today), *"El café está en la esquina"*.\n` +
      `• **Watch out**: *"Soy aburrido"* = I am a boring person, whereas *"Estoy aburrido"* = I feel bored right now!`
  },
  {
    keywords: /\b(por\s+vs\.?\s+para|por\s+and\s+para|difference.*por.*para)\b/i,
    title: 'Por vs. Para in Spanish',
    answer: () =>
      `Think of **Por** as looking backward at the **cause/exchange/through**, and **Para** as looking forward toward the **goal/destination/recipient**:\n` +
      `• **Por** (cause, duration, exchange, means): *"Gracias por tu ayuda"* (reason), *"Pagué 10 euros por el libro"* (exchange), *"Hablamos por videollamada"* (means).\n` +
      `• **Para** (goal, recipient, deadline, destination): *"Estudio para hablar con fluidez"* (goal), *"Este regalo es para ti"* (recipient), *"Lo necesito para mañana"* (deadline).`
  },
  {
    keywords: /\b(akkusativ|dativ|accusative|dative|der\s+die\s+das|german\s+cases?)\b/i,
    title: 'German Cases: Akkusativ vs. Dativ',
    answer: () =>
      `Here is the clearest way to separate **Akkusativ** and **Dativ** in German:\n` +
      `• **Akkusativ (Direct Object / Motion toward "Wohin?")**: Only masculine *der* changes to **den / einen** (*"Ich sehe **den** Hund"*, *"Ich gehe in **den** Park"*).\n` +
      `• **Dativ (Indirect Receiver "Wem?" / Static Location "Wo?")**: Articles shift to **dem** (m/n), **der** (f), **den + n** (plural) (*"Ich gebe **dem** Freund das Buch"*, *"Ich bin **im** Park"*).\n` +
      `• **Core Dativ Verbs**: *helfen, danken, gefallen, gehören, antworten* always take Dativ (*"Ich helfe **dir**"*, never *dich*).`
  },
  {
    keywords: /\b(weil|nebensatz|word\s+order|verb\s+at\s+the\s+end|subordinate)\b/i,
    title: 'German Word Order (V2 & Nebensatz)',
    answer: () =>
      `German word order follows two golden anchors:\n` +
      `1. **Main Clause (Hauptsatz — Verb in Position 2)**: *"Heute **lerne** ich Deutsch."* (Notice *ich* moves after the verb when *Heute* is first!)\n` +
      `2. **Subordinate Clause (Nebensatz — Conjugated Verb at the End)**: Conjunctions like **weil, dass, obwohl, wenn** send the conjugated verb to the very end: *"Ich lerne Deutsch, **weil** ich in Berlin arbeiten **möchte**."*`
  },
  {
    keywords: /\b(pass[eé]\s+compos[eé]|imparfait|preterite|imperfect|indefinido|imperfecto)\b/i,
    title: 'Completed Past Action vs. Ongoing Past Background',
    answer: (lang) =>
      `In ${lang === 'Spanish' ? 'Spanish (**Pretérito Indefinido vs. Imperfecto**)' : 'French (**Passé Composé vs. Imparfait**)'}, think of a movie scene:\n` +
      `• **Completed Event (Timeline Action)**: What suddenly happened or finished -> ${lang === 'Spanish' ? '*"Ayer **llamé** a mi amigo"*' : '*"Hier, **j’ai appelé** mon ami"*'}.\n` +
      `• **Background / Habit (Stage Setting)**: Weather, age, ongoing feelings, or "used to" -> ${lang === 'Spanish' ? '*"**Llovía** cuando salí de casa"*' : '*"Il **pleuvait** quand je suis sorti"*'}.`
  },
  {
    keywords: /\b(subjunctive|subjuntivo|subjonctif|konjunktiv)\b/i,
    title: 'Mastering the Subjunctive Mood',
    answer: (lang) =>
      `The subjunctive in ${lang} expresses **wishes, emotions, doubts, and recommendations** rather than declared facts:\n` +
      `• Trigger pattern: **Subject 1 + wish/doubt/emotion + que + Subject 2 + Subjunctive**.\n` +
      `• Example (Spanish): *"Espero que **tengas** un buen día"* (not *tienes*).\n` +
      `• Example (French): *"Il faut que j’y **aille**"* (from *aller*).\n` +
      `• Example (German Konjunktiv II polite requests): *"Ich **hätte** gern einen Kaffee / **Könnten** Sie mir helfen?"*`
  },
  {
    keywords: /\b(wa\s+vs\.?\s+ga|は.*が|keigo|particles?\s+in\s+japanese)\b/i,
    title: 'Japanese Particles は (wa) vs. が (ga) & Polite Speech',
    answer: () =>
      `Here is the intuitive distinction between **は (wa)** and **が (ga)**:\n` +
      `• **は (wa — Topic Marker "As for X...")**: Sets the known topic and emphasizes what comes *after* it -> 私は学生です (*Watashi wa gakusei desu* — As for me, I’m a student).\n` +
      `• **が (ga — Identifier / New Info / Subject of existence & likes)**: Spotlights *who/what* specifically, or pairs with 好き (like), 分かる (understand), ある/いる (exist) -> 日本語**が**好きです (*Nihongo ga suki desu* — I like Japanese).`
  },
  {
    keywords: /\b(since\s+vs\.?\s+for|present\s+perfect|difference.*since.*for|when\s+to\s+use\s+have\s+been)\b/i,
    title: 'Present Perfect Continuous: Since vs. For',
    answer: () =>
      `In English, when an action started in the past and is **still true right now**, use **have/has been + -ing** (not simple present *"I am living here since..."*):\n` +
      `• **for + duration (length of time)**: *"I **have been learning** German **for** six months."*\n` +
      `• **since + starting point in time**: *"I **have been living** here **since** 2024."*`
  }
];

function detectRequestedLanguage(query: string, fallbackLanguage: string): string {
  const lower = query.toLowerCase();
  if (/\bgerman\b|\bdeutsch\b/.test(lower)) return 'German';
  if (/\bspanish\b|\bespañol\b/.test(lower)) return 'Spanish';
  if (/\bfrench\b|\bfrançais\b/.test(lower)) return 'French';
  if (/\bitalian\b|\bitaliano\b/.test(lower)) return 'Italian';
  if (/\bjapanese\b|\bnihongo\b/.test(lower)) return 'Japanese';
  if (/\bmandarin\b|\bchinese\b/.test(lower)) return 'Mandarin';
  if (/\bportuguese\b|\bportuguês\b/.test(lower)) return 'Portuguese';
  if (/\benglish\b/.test(lower)) return 'English';
  return fallbackLanguage || 'German';
}

function trySafeArithmetic(query: string): string | null {
  const match = query.match(/(?:what\s+is|calculate|solve)?\s*(-?\d+(?:\.\d+)?)\s*([+\-*/x×÷])\s*(-?\d+(?:\.\d+)?)\s*\??$/i);
  if (!match) return null;
  const a = Number(match[1]);
  const op = match[2];
  const b = Number(match[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  let res: number;
  if (op === '+') res = a + b;
  else if (op === '-') res = a - b;
  else if (op === '*' || op.toLowerCase() === 'x' || op === '×') res = a * b;
  else {
    if (b === 0) return 'Division by zero is undefined.';
    res = Number((a / b).toFixed(4));
  }
  return `${a} ${op} ${b} = **${res}**.`;
}

/**
 * Generates an accurate, context-aware AI Coach response whenever Gemini API
 * is unconfigured or unreachable, ensuring users NEVER see errors or generic non-answers.
 */
export function generateAccurateAiCoachReply(params: {
  messages: { sender: string; text: string }[];
  targetLanguage?: string;
  userLevel?: CEFRLevel | string;
  currentTopic?: string;
}): AiCoachResponsePayload {
  const { messages, targetLanguage = 'German', userLevel = 'B1', currentTopic } = params;
  const rawLast = String(messages[messages.length - 1]?.text || '').trim();

  if (!rawLast) {
    return {
      replyText: `Hi! I am Lerni, your AI Language & Knowledge Coach for ${targetLanguage}. Ask me to translate any phrase, check a sentence, explain a grammar rule, or practice a real-world conversation!`,
      suggestions: [
        `How do I say "Nice to meet you" in ${targetLanguage}?`,
        `Give me 5 useful ${targetLanguage} travel phrases`,
        `Start a café ordering roleplay in ${targetLanguage}`
      ],
      modeUsed: 'linguistic-engine'
    };
  }

  const lower = rawLast.toLowerCase();
  const effectiveLang = detectRequestedLanguage(rawLast, targetLanguage);

  // 1. Direct arithmetic / quick calculation check
  const mathAnswer = trySafeArithmetic(rawLast);
  if (mathAnswer) {
    return {
      replyText: `${mathAnswer}\n\nBonus in **${effectiveLang}**: Numbers are great conversation practice—ask me if you'd like to learn how to say numbers, prices, or times naturally in ${effectiveLang}!`,
      suggestions: [
        `How do I tell time in ${effectiveLang}?`,
        `How do I ask for the price in ${effectiveLang}?`
      ],
      modeUsed: 'linguistic-engine'
    };
  }

  // 2. Explicit translation / "How do I say..." queries first so quoted phrases aren't hijacked by grammar keywords
  const isTranslationQuery =
    /\b(translate|how\s+do\s+(?:i|you)\s+say|what\s+is\s+.+\s+in\s+|in\s+(?:german|spanish|french|italian|japanese|mandarin|chinese|portuguese))\b/i.test(
      rawLast
    );

  if (isTranslationQuery) {
    const matchedEntry = PHRASE_DICTIONARY.find((entry) =>
      lower.includes(entry.english)
    );

    if (matchedEntry) {
      const targetData =
        matchedEntry.translations[effectiveLang] ||
        matchedEntry.translations[targetLanguage] ||
        matchedEntry.translations.German;

      return {
        replyText:
          `In **${effectiveLang}**, "${matchedEntry.english}" is:\n\n` +
          `• **${targetData.phrase}**${targetData.pronunciation ? ` *(Pronunciation: ${targetData.pronunciation})*` : ''}\n` +
          `• **Usage tip**: ${targetData.note}`,
        suggestions: [
          `Give me a formal and casual example sentence`,
          `How do I reply when someone says that in ${effectiveLang}?`,
          `Teach me 3 related phrases in ${effectiveLang}`
        ],
        modeUsed: 'linguistic-engine'
      };
    }
  }

  // 3. Grammar & concept comparison questions
  for (const guide of GRAMMAR_TOPIC_GUIDES) {
    if (guide.keywords.test(rawLast)) {
      return {
        replyText: `${guide.answer(effectiveLang)}\n\nWould you like to try writing 1 example sentence of your own so I can check it for you?`,
        suggestions: [
          `Give me 3 quiz sentences on ${guide.title}`,
          `Show me common mistakes to avoid`,
          `Let's practice this in conversation`
        ],
        modeUsed: 'linguistic-engine'
      };
    }
  }

  if (isTranslationQuery) {

    // Extract quoted phrase if provided
    const quotedMatch =
      rawLast.match(/["“'‘]([^"”'’]+)["”'’]/) ||
      rawLast.match(/how\s+do\s+(?:i|you)\s+say\s+(.+?)(?:\s+in\s+\w+)?\??$/i) ||
      rawLast.match(/translate\s+(.+?)(?:\s+(?:to|into|in)\s+\w+)?\??$/i);
    const extracted = quotedMatch?.[1]?.trim() || rawLast;

    const starterMap: Record<string, string> = {
      German: `To express **"${extracted}"** naturally in German (${userLevel}), keep main-clause verbs in position 2 and use polite modal phrasing like *"Könnten Sie mir bitte sagen..."* or *"Ich möchte gern..."*.`,
      Spanish: `To express **"${extracted}"** naturally in Spanish (${userLevel}), drop redundant subject pronouns (*yo/tú*) unless emphasizing contrast, and use *"Me gustaría..."* or *"¿Podrías...?"* for polite tone.`,
      French: `To express **"${extracted}"** naturally in French (${userLevel}), use *"Je voudrais..."* or *"Pourriez-vous..."* in polite contexts and link vowel sounds smoothly.`,
      Italian: `To express **"${extracted}"** naturally in Italian (${userLevel}), use *"Vorrei..."* for polite requests and place descriptive adjectives after the noun.`,
      Japanese: `To express **"${extracted}"** naturally in Japanese (${userLevel}), place the topic first with は (wa) and end the clause with the polite 〜ます / 〜です form.`,
      Mandarin: `To express **"${extracted}"** naturally in Mandarin (${userLevel}), follow Subject + Time + Place + Verb order (e.g., 请问... Qǐngwèn... for polite questions).`,
      Portuguese: `To express **"${extracted}"** naturally in Portuguese (${userLevel}), use *"Gostaria de..."* or *"Você pode..."* for friendly everyday requests.`
    };

    return {
      replyText:
        `${starterMap[effectiveLang] || `Here is a breakdown for **"${extracted}"** in **${effectiveLang}**:`}\n\n` +
        `• **Key structure**: Break the thought into Subject + Action + Context, and prefer idiomatic collocations over word-for-word translation.\n` +
        `• **Tip**: Send me your attempted ${effectiveLang} translation of *"${extracted}"* and I will refine every word and grammar ending for you!`,
      suggestions: [
        `How do I say "Nice to meet you" in ${effectiveLang}?`,
        `How do I say "I have been waiting for two hours" in ${effectiveLang}?`,
        `How do I say "Where is the train station" in ${effectiveLang}?`
      ],
      modeUsed: 'linguistic-engine'
    };
  }

  // 4. Sentence checking / grammar correction request
  const checkSentenceMatch =
    rawLast.match(/(?:check|correct|fix|is\s+this\s+correct|review)\s*[:\-]?\s*["“]?(.+?)["”]?\??$/i);
  if (checkSentenceMatch || rawLast.split(/\s+/).length >= 3) {
    const candidateSentence = (checkSentenceMatch ? checkSentenceMatch[1] : rawLast).trim();
    const analysis = analyzeTextWithRules(candidateSentence, effectiveLang);
    if (analysis.hasErrors && analysis.mistakes.length > 0) {
      const m = analysis.mistakes[0];
      return {
        replyText:
          `I spotted a helpful improvement for your **${effectiveLang}** sentence:\n\n` +
          `• **Polished version**: *"${analysis.correctedText}"*\n` +
          `• **Why**: Replace **"${m.wrongPart}"** with **"${m.suggestion}"** — ${m.explanation}\n` +
          (analysis.betterWords[0]
            ? `• **Native Vocabulary Upgrade**: Try **${analysis.betterWords[0].betterWord}** (${analysis.betterWords[0].whyBetter}).`
            : ''),
        suggestions: [
          `Give me another example using "${m.suggestion}"`,
          `Quiz me on ${m.ruleReference || 'this grammar rule'}`,
          `How would a native say this more formally?`
        ],
        modeUsed: 'linguistic-engine'
      };
    }
  }

  // 5. Vocabulary / "give me words or phrases" requests
  if (/\b(vocab|words|phrases|idioms|expressions|travel|cafe|coffee|interview)\b/i.test(rawLast)) {
    const bundles: Record<string, string> = {
      German:
        `Here are **4 high-impact German phrases** (${userLevel}) you can use right away:\n` +
        `1. **Übrigens...** — *"By the way..."* (smooth topic transition)\n` +
        `2. **Das kommt darauf an.** — *"That depends."*\n` +
        `3. **Ich hätte gern...** — *"I would like..."* (polite ordering)\n` +
        `4. **Meiner Meinung nach...** — *"In my opinion..."* (verb follows immediately!)`,
      Spanish:
        `Here are **4 authentic Spanish expressions** (${userLevel}) natives use daily:\n` +
        `1. **Por cierto...** — *"By the way..."*\n` +
        `2. **Depende de la situación.** — *"It depends on the situation."*\n` +
        `3. **Me apetece mucho...** — *"I really feel like / fancy..."*\n` +
        `4. **Desde mi punto de vista...** — *"From my point of view..."*`,
      French:
        `Here are **4 natural French phrases** (${userLevel}):\n` +
        `1. **D’ailleurs...** — *"Besides / By the way..."*\n` +
        `2. **Ça dépend.** — *"It depends."*\n` +
        `3. **J’ai hâte de...** — *"I can’t wait to..."*\n` +
        `4. **À mon avis...** — *"In my opinion..."*`,
      Japanese:
        `Here are **4 essential Japanese conversational phrases** (${userLevel}):\n` +
        `1. **ちなみに (Chinami ni)...** — *"By the way..."*\n` +
        `2. **場合によります (Baai ni yorimasu).** — *"It depends on the case."*\n` +
        `3. **〜をお願いします (...o onegaishimasu).** — *"I'd like ..., please."*\n` +
        `4. **私の意見では (Watashi no iken dewa)...** — *"In my opinion..."*`
    };

    const replyBody =
      bundles[effectiveLang] ||
      `Here are **4 versatile ${effectiveLang} conversation builders** (${userLevel}):\n` +
        `1. Polite opener: Greet warmly and ask how their day is going.\n` +
        `2. Connector: Use transition phrases (*"In my view"*, *"On the other hand"*) to sound fluent.\n` +
        `3. Clarification: Ask *"Could you repeat that a little slower?"* instead of switching back to English.\n` +
        `4. Follow-up: End your turn with *"And what about you?"* to keep dialogue lively.`;

    return {
      replyText: `${replyBody}\n\nPick any one of these and try using it in a sentence with me!`,
      suggestions: [
        `Let's roleplay ordering at a café in ${effectiveLang}`,
        `Test me with a fill-in-the-blank question`,
        `How do I say "I have been waiting for two hours" in ${effectiveLang}?`
      ],
      modeUsed: 'linguistic-engine'
    };
  }

  // 6. Greetings & conversational check-ins
  if (/^(hi|hello|hey|hola|hallo|bonjour|ciao|konnichiwa|good\s+(morning|afternoon|evening)|who\s+are\s+you)/i.test(rawLast)) {
    const greetingByLang: Record<string, string> = {
      German: 'Hallo! Schön, dass du da bist! ("Great to have you here!")',
      Spanish: '¡Hola! ¡Qué alegría practicar contigo hoy! ("So glad to practice with you today!")',
      French: 'Bonjour ! Ravi(e) de pratiquer avec toi aujourd’hui !',
      Italian: 'Ciao! Che bello praticare insieme oggi!',
      Japanese: 'こんにちは！今日も一緒に楽しく練習しましょう！ ("Let’s enjoy practicing together today!")',
      Mandarin: '你好！很高兴今天和你一起练习！ ("Very happy to practice with you today!")',
      Portuguese: 'Olá! Que ótimo praticar com você hoje!',
      English: 'Hello! Great to connect with you today!'
    };

    return {
      replyText:
        `${greetingByLang[effectiveLang] || greetingByLang.English}\n\n` +
        `I am **Lerni**, your AI Language & Knowledge Coach. You can ask me **any question**—translations, grammar explanations, sentence corrections, vocabulary lists, or live roleplay in **${effectiveLang}** (${userLevel})${currentTopic ? ` around *"${currentTopic}"*` : ''}. What would you like to explore first?`,
      suggestions: [
        `How do I say "Where is the train station" in ${effectiveLang}?`,
        `Explain the most common ${effectiveLang} grammar mistake`,
        `Give me 4 natural ${effectiveLang} idioms`
      ],
      modeUsed: 'linguistic-engine'
    };
  }

  // 7. General thoughtful conversational & analytical response
  const ruleCheck = analyzeTextWithRules(rawLast, effectiveLang);
  const tipLine =
    ruleCheck.betterWords.length > 0
      ? `• **Vocabulary elevation**: Consider **${ruleCheck.betterWords[0].betterWord}** (*${ruleCheck.betterWords[0].exampleSentence}*).`
      : `• **Fluency tip**: ${ruleCheck.nativeNuanceTip}`;

  return {
    replyText:
      `Here is a clear breakdown for **"${rawLast}"** (${effectiveLang} · ${userLevel}):\n\n` +
      `• **Polished phrasing**: *"${ruleCheck.correctedText}"*\n` +
      `• **Coach insight**: ${ruleCheck.overallFeedback}\n` +
      `${tipLine}\n\n` +
      `Want me to translate this into another language, explain a specific grammar rule, or continue this topic in ${effectiveLang}?`,
    suggestions: [
      `Translate "${rawLast.slice(0, 36)}" to ${effectiveLang}`,
      `Give me a harder C1 version of that sentence`,
      `Ask me a follow-up question in ${effectiveLang}`
    ],
    modeUsed: 'linguistic-engine'
  };
}

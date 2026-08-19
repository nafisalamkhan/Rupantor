/* ------------------------------------------------------------------ */
/*  Rupantor conversion engine — pure fetch, no SDK.                  */
/*  Rotates across the Gemini text models a key can actually run.     */
/* ------------------------------------------------------------------ */

export type Lang = "bengali" | "banglish" | "english";

/* The permanent register set — every conversion produces ALL of these. */
export const TONE_KEYS = [
  "professional",
  "semi_professional",
  "friendly",
  "lovely",
  "sad",
  "funny",
  "angry",
  "informal",
  "optimistic",
  "pessimistic",
  "sarcastic",
  "serious",
  "normal",
] as const;

export type ToneKey = (typeof TONE_KEYS)[number];

export interface TonePair {
  english: string;
  bangla: string;
}

export interface ConversionResult {
  detected_language: Lang;
  base_translations: TonePair;
  semantics: Record<ToneKey, TonePair>;
}

export type ErrKind = "quota" | "auth" | "network" | "model" | "transient" | "other";

export class ConvertError extends Error {
  kind: ErrKind;
  constructor(kind: ErrKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export const DEFAULT_MODEL = "auto";

/* Broad, ordered pool of text-capable Gemini models. Free-tier limits are
   per-model, so a wide pool = a much higher effective rate. */
const MODEL_POOL = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-2.5-pro",
  "gemini-1.5-pro",
];

/* Anything that clearly can't produce text output. */
const NON_TEXT = /(tts|speech|audio|vision|imagen|image|video|live|embedding|aqa|tuning|predict)/i;

export function isTextModel(name: string): boolean {
  return !NON_TEXT.test(name);
}

export function prettyModel(id: string): string {
  return id
    .replace(/-(00\d+|latest|preview.*)$/i, "")
    .replace(/^gemini-/, "Gemini ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/ (\d) (\d)/, " $1.$2");
}

/* ------------------------------------------------------------------ */
/* Client-side language detection                                     */
/* ------------------------------------------------------------------ */

const BENGALI_SCRIPT = /[\u0980-\u09FF]/;

const BANGLISH_WORDS = new Set(
  `ami amake amar amader tumi tomake tomar tui apni apnar kemon acho achho ache acchi
  korchi korcho kore koro korlam korbo korsi jani janina jana janis paro pari parbo parbe
  chhai chai bhalo valo valobashi bhalobashi keno ki kothay kotha eta eto ekhon ekhane
  oikhane oikane eita oita oi ei khete kheye khabo khabi khushi mon mone bondhu shundor
  sundor khub onek din raat sokal bikel dupur kal aj ajke ashchi aschi jacchi jachhi jete
  jabo jabi eshe ese thakbo thakbe hoye hoy na nai nei chilo hobe holo hoyeche korte dekha
  dekhbo dekhbe bujhte bujhlam sotti satyi jaan miss boro chhoto manush jibon jiban shanti
  sukhi dukkho koshto kosto obhiman abhiman kanna hasi hashi prem dost kaj pora porte boi
  gaan bhat ruti cha doodh pani ghor bari desh dhaka bangla bangladesh theke niyom mene
  khawa dawa ebong amake sahajjo korbe hobe kemonacho tomay amay`.split(/\s+/)
);

export function detectLanguage(text: string): Lang {
  const t = text.trim();
  if (!t) return "english";
  if (BENGALI_SCRIPT.test(t)) return "bengali";

  const tokens = t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return "english";

  let hits = 0;
  for (const tok of tokens) {
    if (BANGLISH_WORDS.has(tok)) hits++;
    else if (tok.length > 4 && BANGLISH_WORDS.has(tok.replace(/(chch|h+)$/, ""))) hits++;
  }

  const ratio = hits / tokens.length;
  if (hits >= 2 && ratio >= 0.15) return "banglish";
  if (tokens.length <= 4 && hits >= 1) return "banglish";
  return "english";
}

/* ------------------------------------------------------------------ */
/* Ask Google which models this key can actually run                  */
/* ------------------------------------------------------------------ */

export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    /* Only Gemini text models count. Gemma / RecurrentGemma / everything else
       is slow and unreliable for structured output, so it never enters the
       pool — and unlisted models would only waste a request on a 404. */
    const names: string[] = Array.isArray(data.models)
      ? data.models
          .map((m: { name?: string }) => (m?.name ?? "").replace(/^models\//, ""))
          .filter((n: string) => n && /^gemini-/i.test(n) && isTextModel(n))
      : [];
    if (!names.length) return [...MODEL_POOL]; // listing failed or empty → known pool
    const nameSet = new Set(names);
    const ordered = MODEL_POOL.filter((m) => nameSet.has(m)); // pool priority first
    for (const m of names) if (!ordered.includes(m)) ordered.push(m);
    return ordered;
  } catch {
    return [...MODEL_POOL];
  }
}

/* ------------------------------------------------------------------ */
/* Prompt                                                             */
/* ------------------------------------------------------------------ */

const MASTER_PROMPT = `You are Rupantor, an expert translator between English, Bengali (বাংলা script) and Banglish (Bengali written in Latin letters).

Analyze the raw text below. First detect its language: "bengali" (Bengali script), "banglish" (romanized Bengali), or "english".

Then return ONLY a valid JSON object — no markdown fences, no commentary — with exactly this shape:

{
  "detected_language": "bengali" | "banglish" | "english",
  "base_translations": { "english": "...", "bangla": "..." },
  "semantics": {
    "professional": { "english": "...", "bangla": "..." },
    "semi_professional": { "english": "...", "bangla": "..." },
    "friendly": { "english": "...", "bangla": "..." },
    "lovely": { "english": "...", "bangla": "..." },
    "sad": { "english": "...", "bangla": "..." },
    "funny": { "english": "...", "bangla": "..." },
    "angry": { "english": "...", "bangla": "..." },
    "informal": { "english": "...", "bangla": "..." },
    "optimistic": { "english": "...", "bangla": "..." },
    "pessimistic": { "english": "...", "bangla": "..." },
    "sarcastic": { "english": "...", "bangla": "..." },
    "serious": { "english": "...", "bangla": "..." },
    "normal": { "english": "...", "bangla": "..." }
  }
}

Rules:
1. base_translations.english — a clean, natural, grammatically correct English version.
2. base_translations.bangla — a clean, natural Bengali-script version: if the input is Banglish, convert it into proper শুদ্ধ বাংলা with correct spelling; if it is Bengali, correct grammar and spelling; if it is English, translate it.
3. COMPLETENESS IS MANDATORY: translate the ENTIRE text. Every sentence of the input must appear in the output, in the same order. NEVER summarize, condense, shorten, skip, or merge sentences. The output must match the input's sentence count and overall length. Preserve paragraph breaks as \\n\\n.
4. Each entry in semantics preserves the exact same FULL content — no shortening — re-expressed in that tone, in BOTH languages:
   - professional: formal, polished, workplace-appropriate.
   - semi_professional: warm but respectful — a polite everyday register.
   - friendly: casual and relaxed, like texting a close friend.
   - lovely: affectionate, tender, romantic.
   - sad: melancholic, wistful, heavy-hearted.
   - funny: humorous, playful, lighthearted — makes the reader smile.
   - angry: irritated, sharp, frustrated — an annoyed edge throughout.
   - informal: relaxed everyday speech with no formality at all.
   - optimistic: hopeful and positive, looking on the bright side.
   - pessimistic: doubtful, gloomy, expecting the worst.
   - sarcastic: ironic and dryly mocking — says the opposite of what's meant.
   - serious: grave, earnest, no joking — weighty and deliberate.
   - normal: plain, neutral, matter-of-fact — the everyday default tone.
5. Never invent new facts. Bengali values must use Bengali script only.

Raw text:
"""
{text}
"""`;

function pair(v: unknown): TonePair {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return {
      english: typeof o.english === "string" ? o.english : "",
      bangla: typeof o.bangla === "string" ? o.bangla : "",
    };
  }
  if (typeof v === "string") return { english: v, bangla: "" };
  return { english: "", bangla: "" };
}

function sanitize(raw: unknown, fallbackLang: Lang): ConversionResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const detectedRaw = typeof o.detected_language === "string" ? o.detected_language : "";
  const detected: Lang =
    detectedRaw === "bengali" || detectedRaw === "banglish" || detectedRaw === "english"
      ? detectedRaw
      : fallbackLang;

  const sem = (
    o.semantics && typeof o.semantics === "object" ? o.semantics : {}
  ) as Record<string, unknown>;

  const base = pair(o.base_translations);
  if (!base.english && !base.bangla) {
    throw new ConvertError("transient", "empty translation"); // rotate silently
  }

  /* Every permanent register — fall back to the base translation if the
     model omitted or emptied one, so a row is never blank. */
  const semantics = {} as Record<ToneKey, TonePair>;
  for (const k of TONE_KEYS) {
    const p = pair(sem[k]);
    semantics[k] = p.english || p.bangla ? p : { ...base };
  }

  return {
    detected_language: detected,
    base_translations: base,
    semantics,
  };
}

/* ------------------------------------------------------------------ */
/* Single REST call to one model                                      */
/* ------------------------------------------------------------------ */

async function callModel(
  apiKey: string,
  modelId: string,
  prompt: string,
  signal?: AbortSignal
): Promise<ConversionResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.75,
          maxOutputTokens: 8192,
        },
      }),
    });
  } catch (e) {
    if (signal?.aborted) throw new ConvertError("other", "cancelled");
    throw new ConvertError("network", "Couldn't reach Gemini — check your connection.");
  }

  const body = await res.text();
  let parsedBody: Record<string, unknown> = {};
  try {
    parsedBody = JSON.parse(body);
  } catch {
    parsedBody = {};
  }
  const errMsg =
    (parsedBody?.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
  const gstatus = (parsedBody?.error as { status?: string } | undefined)?.status ?? "";

  if (res.status === 400 && /API key|permission/i.test(errMsg))
    throw new ConvertError("auth", "That API key was rejected by Google. Check it and try again.");
  if (res.status === 403)
    throw new ConvertError("auth", "This key doesn't have access to Gemini. Check it in AI Studio.");
  if (res.status === 404 || gstatus === "NOT_FOUND")
    throw new ConvertError("model", `The model “${modelId}” isn't available for this key.`);
  if (/modalit|not supported by the model|AUDIO/i.test(errMsg))
    throw new ConvertError("model", `The model “${modelId}” can't produce text output.`);
  if (res.status === 429 || gstatus === "RESOURCE_EXHAUSTED")
    throw new ConvertError("quota", "rate-limited");
  if (res.status >= 500)
    throw new ConvertError("transient", "server hiccup"); // rotate silently
  if (res.status === 400) {
    /* Never leak Google's raw error strings to the user. */
    if (/token|too large|exceeds/i.test(errMsg))
      throw new ConvertError(
        "other",
        "Your text is too long for a single request — try a shorter sentence or paragraph."
      );
    throw new ConvertError("other", "Gemini couldn't process this request. Please try again.");
  }
  if (!res.ok)
    throw new ConvertError("other", "Something went wrong on Gemini's side. Please try again.");

  const cand = (parsedBody?.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined)?.[0];
  let text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  text = text
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  if (!text) throw new ConvertError("transient", "empty response"); // rotate silently

  /* Models sometimes wrap the JSON in prose or append trailing text.
     Try the raw text first, then fall back to the outermost {…} object. */
  let parsed: unknown = null;
  const tryParse = (s: string) => {
    try {
      parsed = JSON.parse(s);
      return true;
    } catch {
      return false;
    }
  };
  if (!tryParse(text)) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start || !tryParse(text.slice(start, end + 1))) {
      /* Unrecoverable for this attempt — rotate to another model silently
         instead of surfacing a developer-facing error. */
      throw new ConvertError("transient", "unparsable response");
    }
  }
  return sanitize(parsed, "english");
}

/* ------------------------------------------------------------------ */
/* Long-text chunking (paragraph → sentence aware)                    */
/* ------------------------------------------------------------------ */

const TARGET_CHUNK = 1700;

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?।…])\s+/);
}

export function splitIntoChunks(text: string): string[] {
  if (text.length <= 2200) return [text];
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let cur = "";

  const flush = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = "";
  };

  for (const para of paragraphs) {
    if ((cur + "\n\n" + para).length <= TARGET_CHUNK || !cur) {
      if (para.length <= TARGET_CHUNK) {
        cur = cur ? cur + "\n\n" + para : para;
        continue;
      }
    }
    /* Paragraph doesn't fit — split it by sentences. */
    if (cur) flush();
    for (const sentence of splitSentences(para)) {
      if ((cur + " " + sentence).trim().length <= TARGET_CHUNK) {
        cur = cur ? cur + " " + sentence : sentence;
      } else {
        flush();
        cur = sentence.length <= TARGET_CHUNK ? sentence : sentence.slice(0, TARGET_CHUNK);
      }
    }
  }
  flush();
  return chunks;
}

function mergeParts(parts: ConversionResult[], sourceText: string): ConversionResult {
  const first = parts[0];
  const joinEn = (sel: (p: ConversionResult) => string) => parts.map(sel).filter(Boolean).join(" ");
  const joinBn = (sel: (p: ConversionResult) => string) => parts.map(sel).filter(Boolean).join(" ");

  const semantics = {} as ConversionResult["semantics"];
  (Object.keys(first.semantics) as ToneKey[]).forEach((k) => {
    semantics[k] = {
      english: joinEn((p) => p.semantics[k]?.english ?? ""),
      bangla: joinBn((p) => p.semantics[k]?.bangla ?? ""),
    };
  });

  return {
    detected_language: first.detected_language,
    base_translations: {
      english: joinEn((p) => p.base_translations.english),
      bangla: joinBn((p) => p.base_translations.bangla),
    },
    semantics,
  };
}

/* ------------------------------------------------------------------ */
/* Quota-rotating conversion — the "feels unlimited" engine           */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Models that 404'd or can't emit text for this key — remembered across
   conversions so we never pay that round-trip twice in a session. */
const sessionDead = new Set<string>();

/**
 * Public entry point. Long text is split into paragraph/sentence-aware
 * chunks, each converted through the rotating engine, then merged back so
 * the output always covers the ENTIRE input.
 */
export async function convertText(
  apiKey: string,
  text: string,
  preferredModel: string = DEFAULT_MODEL,
  available: string[] = [],
  onStatus?: (msg: string) => void,
  signal?: AbortSignal
): Promise<{ result: ConversionResult; ms: number; model: string; calls: number }> {
  const trimmed = text.trim();
  const chunks = splitIntoChunks(trimmed);
  if (chunks.length <= 1) {
    const out = await convertOnce(apiKey, trimmed, preferredModel, available, onStatus, signal);
    return { ...out, calls: 1 };
  }
  const t0 = performance.now();
  const parts: ConversionResult[] = [];
  let model = "";
  /* Warm, human progress — never expose internal part numbers. */
  const FRIENDLY = [
    "Translating everything you wrote…",
    "Working through the rest…",
    "Still with you — nearly there…",
    "Polishing the last lines…",
  ];
  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) throw new ConvertError("other", "cancelled");
    onStatus?.(
      i === 0
        ? "Reading your full text…"
        : i === chunks.length - 1
          ? "Adding the finishing touches…"
          : FRIENDLY[Math.min(i - 1, FRIENDLY.length - 1)]
    );
    const out = await convertOnce(apiKey, chunks[i], preferredModel, available, undefined, signal);
    if (!model) model = out.model;
    parts.push(out.result);
  }
  onStatus?.("Putting it all together…");
  return { result: mergeParts(parts, trimmed), ms: Math.round(performance.now() - t0), model, calls: chunks.length };
}

async function convertOnce(
  apiKey: string,
  text: string,
  preferredModel: string = DEFAULT_MODEL,
  available: string[] = [],
  onStatus?: (msg: string) => void,
  signal?: AbortSignal
): Promise<{ result: ConversionResult; ms: number; model: string }> {
  const prompt = MASTER_PROMPT.replace("{text}", text);
  const fallbackLang = detectLanguage(text);

  /* Curated pool: Gemini text models this key actually lists — anything else
     would just 404 and waste seconds. Preferred model goes first. */
  const listed = available.filter((m) => /^gemini-/i.test(m) && isTextModel(m));
  const pool = listed.length ? listed : [...MODEL_POOL];
  const ordered: string[] = [];
  if (preferredModel !== DEFAULT_MODEL && pool.includes(preferredModel)) {
    ordered.push(preferredModel);
  }
  for (const m of pool) {
    if (!ordered.includes(m)) ordered.push(m);
  }
  if (!ordered.length) ordered.push(...MODEL_POOL);

  const t0 = performance.now();
  const deadline = t0 + 40_000; // tight window — normal path finishes in one call
  const cooldown = new Map<string, number>(); // model -> earliest retry (ms epoch)
  const MODEL_COOLDOWN = 1_500; // brief park after a 429 — keep rotating fast

  const keyTag = apiKey.slice(0, 8);
  const isDead = (m: string) => sessionDead.has(`${keyTag}:${m}`);
  const markDead = (m: string) => sessionDead.add(`${keyTag}:${m}`);

  let lastError: ConvertError | null = null;
  let attempts = 0;
  let lastTried = "";
  /* Models already known to be unavailable for this key — skip them for the
     whole run; rotating back to them would be pointless. */
  const dead = new Set<string>();

  while (performance.now() < deadline) {
    if (signal?.aborted) throw new ConvertError("other", "cancelled");
    let triedAny = false;

    for (const model of ordered) {
      if (performance.now() >= deadline) break;
      if (signal?.aborted) throw new ConvertError("other", "cancelled");
      if (dead.has(model) || isDead(model)) continue; // unavailable for this key
      const readyAt = cooldown.get(model) ?? 0;
      if (Date.now() < readyAt) continue; // this model is cooling down

      triedAny = true;
      attempts++;
      onStatus?.(
        attempts === 1 || !lastTried
          ? `Converting with ${prettyModel(model)}…`
          : `Switching to ${prettyModel(model)}…`
      );
      lastTried = model;

      try {
        const result = await callModel(apiKey, model, prompt, signal);
        result.detected_language =
          result.detected_language === "english" && fallbackLang !== "english"
            ? fallbackLang
            : result.detected_language;
        return { result, ms: Math.round(performance.now() - t0), model };
      } catch (e) {
        if (signal?.aborted) throw new ConvertError("other", "cancelled");
        const err =
          e instanceof ConvertError
            ? e
            : new ConvertError("other", "Something unexpected happened on our side. Please try again.");
        if (err.kind === "quota" || err.kind === "transient") {
          /* Rate-limited or a bad/empty response — never surfaced to the user.
             Park this model briefly and rotate to the next one. */
          cooldown.set(model, Date.now() + MODEL_COOLDOWN);
          lastError = err;
          continue;
        }
        if (err.kind === "model") {
          /* This model 404'd or can't emit text for this key. Retire it for
             the whole session and keep rotating. */
          dead.add(model);
          markDead(model);
          lastError = err;
          continue;
        }
        /* auth / network / other → rotating won't help; surface it. */
        throw err;
      }
    }

    if (!triedAny) {
      const alive = ordered.filter((m) => !dead.has(m) && !isDead(m));
      if (!alive.length) {
        /* Nothing left to try for this key — don't spin, just explain. */
        throw new ConvertError(
          "model",
          "None of Gemini's text models are enabled for this key yet. Open AI Studio once and the models unlock within a minute — then press Convert again."
        );
      }
      /* Every live model is cooling down — wait for the soonest one to free up. */
      const soonest = Math.min(...alive.map((m) => cooldown.get(m) ?? Date.now()));
      const wait = Math.max(300, soonest - Date.now());
      onStatus?.("Still working on it — one moment…");
      await sleep(Math.min(wait, 4000));
    }
  }

  throw new ConvertError(
    "quota",
    "Gemini is unusually busy and we couldn't finish this one just now. Your key and text are fine — wait about 30 seconds, then press Retry."
  );
}

/* ------------------------------------------------------------------ */
/* Connection test for the error panel                                */
/* ------------------------------------------------------------------ */

export async function testConnection(
  apiKey: string
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(apiKey)}`
    );
    if (res.ok) {
      return { ok: true, detail: "Connected — your key works and Gemini is responding." };
    }
    if (res.status === 400 || res.status === 403) {
      return {
        ok: false,
        detail: "Google rejected this key. Double-check it in AI Studio — a fresh key fixes it instantly.",
      };
    }
    if (res.status === 429) {
      return { ok: true, detail: "Connected — your key is fine, it's just briefly rate-limited right now." };
    }
    return { ok: false, detail: "Gemini answered with an unexpected status. Try again in a moment." };
  } catch {
    return {
      ok: false,
      detail: "No response from Google at all — this looks like a network or region block, not your key.",
    };
  }
}

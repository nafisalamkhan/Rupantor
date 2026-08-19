import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Angry,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Check,
  Cloud,
  CloudRain,
  Coffee,
  Copy,
  Github,
  Heart,
  KeyRound,
  Languages,
  Laugh,
  Loader2,
  Meh,
  Minus,
  MoonStar,
  RefreshCw,
  Scale,
  Send,
  Smile,
  Sparkles,
  Sun,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  ConvertError,
  DEFAULT_MODEL,
  convertText,
  detectLanguage,
  fetchAvailableModels,
  prettyModel,
  testConnection,
  type ConversionResult,
  type ErrKind,
  type Lang,
  type ToneKey,
} from "./lib/gemini";
import Background from "./components/Background";
import ApiKeyModal, { looksLikeKey, readStoredKey } from "./components/ApiKeyModal";

/* ------------------------------ constants ----------------------------- */

const HISTORY_KEY = "rupantor:history";
const THEME_KEY = "rupantor:theme";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const TONES: {
  key: ToneKey;
  label: string;
  bn: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  { key: "professional", label: "Professional", bn: "পেশাদার", icon: Briefcase, accent: "#b24bf3" },
  { key: "semi_professional", label: "Semi-Professional", bn: "ভদ্র", icon: Users, accent: "#8f86ff" },
  { key: "friendly", label: "Friendly", bn: "বন্ধুত্ব", icon: Smile, accent: "#f0abfc" },
  { key: "lovely", label: "Lovely", bn: "আদর", icon: Heart, accent: "#ff7ab8" },
  { key: "sad", label: "Melancholic", bn: "বিষণ্ণতা", icon: CloudRain, accent: "#7dd3fc" },
  { key: "funny", label: "Funny", bn: "মজার", icon: Laugh, accent: "#fbbf24" },
  { key: "angry", label: "Angry", bn: "রাগ", icon: Angry, accent: "#fb7185" },
  { key: "informal", label: "Informal", bn: "অনানুষ্ঠানিক", icon: Coffee, accent: "#5eead4" },
  { key: "optimistic", label: "Optimistic", bn: "আশাবাদী", icon: Sun, accent: "#facc15" },
  { key: "pessimistic", label: "Pessimistic", bn: "নিরাশ", icon: Cloud, accent: "#94a3b8" },
  { key: "sarcastic", label: "Sarcastic", bn: "ব্যঙ্গ", icon: Meh, accent: "#c084fc" },
  { key: "serious", label: "Serious", bn: "গম্ভীর", icon: Scale, accent: "#a1a1aa" },
  { key: "normal", label: "Normal", bn: "স্বাভাবিক", icon: Minus, accent: "#e2e8f0" },
];

const SAMPLES: { label: string; text: string }[] = [
  { label: "বাংলা", text: "আজ অফিসের মিটিং বিকেল চারটায় শুরু হবে।" },
  {
    label: "Banglish",
    text: "ami kal theke niyom mene khawa dawa korbo ebong tumi eta te amake sahajjo korbe",
  },
  { label: "English", text: "The project deadline was moved to next Friday." },
];

const LANG_META: Record<Lang, { label: string; bn: string; dot: string }> = {
  bengali: { label: "Bengali", bn: "বাংলা", dot: "#b24bf3" },
  banglish: { label: "Banglish", bn: "বাংলিশ", dot: "#8f86ff" },
  english: { label: "English", bn: "ইংরেজি", dot: "#e9e2ff" },
};


const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.7, delay, ease: EASE },
});

/* ------------------------------- ticker -------------------------------- */
/* Pure DOM + CSS crossfade; the box sizes to its widest word so long tone
   names are never clipped. No animation library in the hero. */

function ToneTicker() {
  const items = useMemo(
    () => TONES.map((t) => ({ en: t.label.toUpperCase(), bn: t.bn })),
    []
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((v) => v + 1), 2400);
    return () => window.clearInterval(t);
  }, []);
  const active = items.length ? i % items.length : 0;
  return (
    <div className="hidden shrink-0 self-end sm:block">
      <div className="text-right text-[9px] font-semibold uppercase tracking-[0.28em] text-white/35">
        Registers · রূপ
      </div>
      <div className="ticker mt-1.5" aria-hidden="true">
        {items.map((item, idx) => (
          <div key={item.en} className={`ticker-item${idx === active ? " active" : ""}`}>
            <span className="font-display text-[15px] font-semibold tracking-wide text-white/90">{item.en}</span>
            <span className="font-bangla-display ml-2.5 text-[17px] text-[#c9a9ff]">{item.bn}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- little pieces ----------------------------- */

function StepTag({ en, bn }: { en: string; bn: string }) {
  return (
    <div className="step-tag">
      <span>{en}</span>
      <span className="bn font-bangla">{bn}</span>
    </div>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function CopyChip({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={async () => {
        const done = await copyToClipboard(text);
        if (done) {
          setOk(true);
          window.setTimeout(() => setOk(false), 1500);
        }
      }}
      className="btn-ghost flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-white/55 hover:text-white"
      aria-label="Copy"
    >
      {ok ? <Check size={12} className="text-[#c9a9ff]" /> : <Copy size={12} />}
      {ok ? "Copied" : "Copy"}
    </motion.button>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: "dark" | "light"; onToggle: () => void }) {
  const light = theme === "light";
  return (
    <motion.button
      onClick={onToggle}
      className="key-pill relative flex h-8 w-[62px] items-center px-1"
      role="switch"
      aria-checked={light}
      aria-label="Toggle light mode"
      whileTap={{ scale: 0.95 }}
    >
      <motion.span
        className="liquid-logo absolute left-1 top-1 flex h-6 w-6 items-center justify-center"
        animate={{ x: light ? 30 : 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {light ? (
            <motion.span
              key="sun"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Sun size={12} className="text-[#fff]" />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <MoonStar size={12} className="text-[#fff]" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
      <span className="sr-only">{light ? "Switch to dark mode" : "Switch to light mode"}</span>
    </motion.button>
  );
}

/* ------------------------------ tone rows ------------------------------ */

const ToneRow = memo(function ToneRow({
  label,
  bn,
  accent,
  icon: Icon,
  en,
  bnText,
  index,
}: {
  label: string;
  bn: string;
  accent: string;
  icon: LucideIcon;
  en: string;
  bnText: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.055, ease: EASE }}
    >
      <div className="register-row" style={{ "--tone": accent } as CSSProperties}>
        <span className="tick" />
        <div className="flex items-start justify-between gap-2 self-start">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
              style={{
                background: `linear-gradient(140deg, ${accent}, #7028e4)`,
                boxShadow: `0 4px 16px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
            >
              <Icon size={14} className="text-[#fff]" />
            </span>
            <div>
              <div className="text-[13px] font-semibold text-white/90">{label}</div>
              <div className="font-bangla text-[10.5px] text-white/35">{bn}</div>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[14.5px] leading-relaxed text-white/85">{en}</p>
          <p className="font-bangla mt-1.5 text-[14px] leading-relaxed text-white/55">{bnText}</p>
          <div className="mt-2 flex justify-end">
            <CopyChip text={`${en}\n${bnText}`} />
          </div>
        </div>
      </div>
    </motion.div>
  );
});

function SkeletonRows({ status }: { status: string }) {
  return (
    <div className="px-6 py-6 sm:px-7">
      <div className="flex items-center gap-2 text-[11.5px] text-[#c9a9ff]">
        <span className="dotty">
          <i />
          <i />
          <i />
        </span>
        <span className="text-white/55">{status || "Working…"}</span>
      </div>
      <div className="mt-5 space-y-3">
        <div className="skeleton h-3.5 w-2/3" />
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-5/6" />
        <div className="skeleton mt-5 h-3.5 w-1/2" />
        <div className="skeleton h-3.5 w-4/6" />
        <div className="skeleton h-3.5 w-3/4" />
      </div>
    </div>
  );
}

/* ------------------------------- app ----------------------------------- */

interface HistEntry {
  text: string;
  lang: Lang;
  ts: number;
}

function Converter() {
  const [text, setText] = useState("");
  const [apiKey, setApiKey] = useState<string>(() => readStoredKey());
  const [modalOpen, setModalOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  /* apply the theme to <html> so every scoped override lines up */
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "light") el.dataset.theme = "light";
    else delete el.dataset.theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch { /* private mode */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f4f1fb" : "#06040b");
  }, [theme]);

  const [result, setResult] = useState<ConversionResult | null>(null);
  const [resultText, setResultText] = useState("");
  const [latency, setLatency] = useState(0);
  const [usedModel, setUsedModel] = useState("");
  const [callCount, setCallCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<{ message: string; kind: ErrKind } | null>(null);
  const [activeTone, setActiveTone] = useState<string>("all");
  const [diag, setDiag] = useState<{ running: boolean; detail: string; ok: boolean } | null>(null);
  const [autoTries, setAutoTries] = useState(0);
  const [retryIn, setRetryIn] = useState(0);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [toast, setToast] = useState<{ id: number; msg: string; kind: "ok" | "err" } | null>(null);

  const [history, setHistory] = useState<HistEntry[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return (parsed as Array<Record<string, unknown>>)
        .filter((e) => e && typeof e.text === "string" && typeof e.ts === "number")
        .map((e) => ({
          text: e.text as string,
          lang: (["bengali", "banglish", "english"] as const).includes(e.lang as Lang)
            ? (e.lang as Lang)
            : "english",
          ts: e.ts as number,
        }));
    } catch {
      return [];
    }
  });

  const reqRef = useRef(0);
  const outRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lang = useMemo(() => detectLanguage(text), [text]);
  const hasKey = looksLikeKey(apiKey);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
    } catch { /* private mode */ }
  }, [history]);

  /* Learn which Gemini models this key can actually run. */
  useEffect(() => {
    if (!apiKey) {
      setAvailableModels([]);
      return;
    }
    let on = true;
    fetchAvailableModels(apiKey).then((m) => {
      if (on) setAvailableModels(m);
    });
    return () => {
      on = false;
    };
  }, [apiKey]);

  const showToast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ id: Date.now(), msg, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* ------------------------------- convert ------------------------------ */

  const run = useCallback(
    async (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      if (!hasKey) {
        setModalOpen(true);
        showToast("Add your free Google API key to start", "err");
        return;
      }
      const id = ++reqRef.current;
      /* Cancel any in-flight conversion so it can't burn quota or update UI. */
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      setDiag(null);
      setStatus("Warming up…");
      try {
        const out = await convertText(
          apiKey,
          t,
          DEFAULT_MODEL,
          availableModels,
          (m) => {
            if (id === reqRef.current) setStatus(m);
          },
          controller.signal
        );
        if (id !== reqRef.current) return;
        setResult(out.result);
        setResultText(t);
        setLatency(out.ms);
        setUsedModel(out.model);
        setCallCount(out.calls);
        setAutoTries(0);
        setRetryIn(0);
        setHistory((h) =>
          [{ text: t, lang: detectLanguage(t), ts: Date.now() }, ...h.filter((x) => x.text !== t)].slice(0, 12)
        );
      } catch (e) {
        if (id !== reqRef.current) return;
        if (controller.signal.aborted) return; // superseded by a newer conversion
        if (!(e instanceof ConvertError && e.kind === "quota")) setAutoTries(0);
        setError(
          e instanceof ConvertError
            ? { message: e.message, kind: e.kind }
            : { message: "Something unexpected happened on our side. Please try again.", kind: "other" }
        );
      } finally {
        if (id === reqRef.current) setLoading(false);
      }
    },
    [apiKey, availableModels, hasKey, showToast]
  );

  /* Gentle auto-retry: if every model was briefly busy, wait for the free-tier
     window to reset and quietly try again — up to twice, then rest. */
  useEffect(() => {
    if (error?.kind !== "quota" || loading) return;
    if (autoTries >= 2) {
      setRetryIn(0);
      return;
    }
    let n = 12;
    setRetryIn(n);
    const tick = window.setInterval(() => {
      n -= 1;
      setRetryIn(n);
      if (n <= 0) {
        window.clearInterval(tick);
        setAutoTries((v) => v + 1);
        run(resultText || text);
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [error, loading, autoTries, run, resultText, text]);

  /* Bring results into view on smaller screens. */
  useEffect(() => {
    if (!result) return;
    if (window.matchMedia("(max-width: 1023px)").matches) {
      const t = window.setTimeout(() => {
        outRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return () => window.clearTimeout(t);
    }
  }, [result]);

  useEffect(() => {
    if (activeTone !== "all" && !result) setActiveTone("all");
  }, [activeTone, result]);

  /* ----------------------------- derived -------------------------------- */

  const resultLang: Lang = result?.detected_language ?? lang;

  const visibleTones =
    activeTone === "all" ? TONES : TONES.filter((t) => t.key === activeTone);

  const proofLabels =
    resultLang === "banglish"
      ? { en: "Corrected English", enBn: "শুদ্ধ ইংরেজি", bn: "শুদ্ধ বাংলা", bnBn: "Corrected Bangla" }
      : resultLang === "bengali"
        ? { en: "Corrected English", enBn: "শুদ্ধ ইংরেজি", bn: "Corrected বাংলা", bnBn: "শুদ্ধ বাংলা" }
        : { en: "Corrected English", enBn: "শুদ্ধ ইংরেজি", bn: "বাংলা অনুবাদ", bnBn: "Bengali translation" };

  const copyAll = result
    ? [
        `${proofLabels.en} — ${result.base_translations.english}`,
        `${proofLabels.bn} — ${result.base_translations.bangla}`,
        ...TONES.map((t) => `${t.label} · EN — ${result.semantics[t.key].english}`),
        ...TONES.map((t) => `${t.label} · BN — ${result.semantics[t.key].bangla}`),
      ].join("\n")
    : "";

  /* -------------------------------- render ------------------------------ */

  return (
    <>
      <div className="app-shell">
        <Background />

        {/* ------------------------------- topbar ------------------------------- */}
        <header className="topbar">
          <div className="mx-auto flex h-[64px] max-w-[1080px] items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="liquid-logo liquid-blob flex h-9 w-9 shrink-0 items-center justify-center">
                <Languages size={15} className="text-[#fff]" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-[15px] font-bold leading-tight text-white">Rupantor</div>
                <div className="font-bangla-display mt-1 truncate text-[11px] leading-none text-white/40">
                  রূপান্তর — এক ভাষা, অনেক রূপ
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setModalOpen(true)}
                className="key-pill flex items-center gap-2 px-3 py-2 text-[11.5px] text-white/70 hover:text-white sm:px-4"
              >
                <KeyRound size={13} className="text-[#c9a9ff]" />
                <span className="hidden sm:inline">{hasKey ? "API key set" : "Set API key"}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${hasKey ? "bg-[#8ce6be]" : "bg-[#ff9db4]"}`}
                  style={{ boxShadow: hasKey ? "0 0 8px rgba(140,230,190,0.8)" : "0 0 8px rgba(255,157,180,0.7)" }}
                />
              </motion.button>
            </div>
          </div>
        </header>

        {/* ------------------------------- masthead ------------------------------ */}
        <section className="pb-10 pt-[110px] sm:pt-[128px]">
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0">
              <h1 className="display-bangla m-0">
                এক লাইন লিখুন — <em>ভিন্ন রূপে</em> ফিরে পান।
              </h1>
              <p className="mt-5 max-w-[520px] text-[14px] leading-relaxed text-white/55">
                Type one line in <span className="text-white/85">Bengali</span>,{" "}
                <span className="text-white/85">Banglish</span> or{" "}
                <span className="text-white/85">English</span> — get it back corrected, translated, and
                reborn in thirteen registers, from Professional to Sarcastic. One Gemini call does it all.
              </p>
            </div>
            <ToneTicker />
          </div>
        </section>

        {/* ------------------------------- composer ------------------------------ */}
        <motion.section {...fadeUp(0.05)}>
          <StepTag en="Write" bn="লিখুন" />
          <div className="liquid-card card-lift relative mt-3.5 overflow-hidden p-5 sm:p-7">
            <div className={`work-strip ${loading ? "on" : ""}`}>
              <i />
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  run(text);
                }
              }}
              rows={5}
              placeholder="যেমন: আজকের আবহাওয়া কেমন হবে?  /  ajker abohawa kemon hobe?  /  What's the weather like today?"
              className="glass-input font-bangla w-full resize-y bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-white"
            />

            {/* live language read */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: LANG_META[lang].dot, boxShadow: `0 0 10px ${LANG_META[lang].dot}88` }}
                />
                <span className="text-[11.5px] text-white/60">
                  Detected: <span className="font-semibold text-white/90">{LANG_META[lang].label}</span>{" "}
                  <span className="font-bangla text-white/40">{LANG_META[lang].bn}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/30">
                  13 registers
                </span>
              </div>
            </div>

            {/* convert row */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-white/35">
                <kbd className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9.5px] text-white/50">⌘/Ctrl</kbd>{" "}
                +{" "}
                <kbd className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9.5px] text-white/50">↵</kbd>{" "}
                also works
              </p>
              <motion.button
                whileHover={{ scale: text.trim() && !loading ? 1.02 : 1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => run(text)}
                disabled={!text.trim() || loading}
                className="btn-primary flex items-center gap-2 px-6 py-3 text-[13px] font-semibold"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {loading ? "Converting…" : "Convert"}
              </motion.button>
            </div>
          </div>
        </motion.section>

        {/* -------------------------------- result ------------------------------- */}
        <div ref={outRef} className="scroll-mt-24">
          <motion.section {...fadeUp(0.08)} className="mt-10">
            <div className="flex items-center justify-between">
              <StepTag en="Result" bn="ফলাফল" />
              {result && !loading && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[10.5px] text-white/40">
                    <Sparkles size={11} className="text-[#c9a9ff]" />
                    {callCount} {callCount === 1 ? "call" : "calls"} · {(latency / 1000).toFixed(1)} s · via{" "}
                    {prettyModel(usedModel)}
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => run(resultText || text)}
                    className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 text-[10.5px] text-white/50 hover:text-white"
                  >
                    <RefreshCw size={11} />
                    Regenerate
                  </motion.button>
                  <CopyChip text={copyAll} />
                </div>
              )}
            </div>

            {/* empty */}
            {!result && !loading && !error && (
              <div className="liquid-card mt-3.5 flex flex-col items-center px-6 py-14 text-center">
                <div className="liquid-logo liquid-blob float-y flex h-14 w-14 items-center justify-center">
                  <BookOpen size={22} className="text-[#fff]" />
                </div>
                <p className="font-bangla-display mt-5 text-[17px] text-white/70">লিখুন, তারপর Convert চাপুন</p>
                <p className="mt-2 max-w-[360px] text-[13px] leading-relaxed text-white/45">
                  Your conversion appears here — the corrected translation on top and all thirteen
                  registers below, from <span className="text-[#c9a9ff]">Professional</span> to{" "}
                  <span className="text-[#c9a9ff]">Sarcastic</span>.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {TONES.map((t) => (
                    <span key={t.key} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10.5px] text-white/50">
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* loading */}
            {loading && (
              <div className="liquid-card mt-3.5 overflow-hidden">
                <SkeletonRows status={status} />
              </div>
            )}

            {/* quota recharging — calm, while silent auto-retries remain */}
            {error && !loading && error.kind === "quota" && autoTries < 2 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="liquid-card mt-3.5 p-6"
              >
                <div className="flex items-start gap-3">
                  <div className="liquid-logo liquid-blob flex h-9 w-9 shrink-0 items-center justify-center">
                    <Loader2 size={15} className="animate-spin text-[#fff]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-white">
                      Free quota is recharging
                      <span className="font-bangla ml-2 text-[12px] font-normal text-white/40">কোটা রিচার্জ হচ্ছে</span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">
                      Thirteen registers use up the minute's allowance quickly. We're waiting for it to
                      reset and will retry automatically
                      {retryIn > 0 ? ` in ${retryIn}s` : "…"} — nothing for you to do.
                    </p>
                    <div className="mt-3">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setAutoTries(0);
                          setRetryIn(0);
                          run(resultText || text);
                        }}
                        className="btn-ghost px-3 py-1.5 text-[11.5px] text-white/55 hover:text-white"
                      >
                        Can't wait? Retry now
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* hard errors, or quota after silent retries are spent */}
            {error && !loading && (error.kind !== "quota" || autoTries >= 2) && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="liquid-card mt-3.5 p-6"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#ff9db4]" />
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-white">
                      {error.kind === "quota" ? "Almost there" : "Conversion paused"}
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">{error.message}</p>
                    {error.kind === "quota" && retryIn > 0 && (
                      <p className="mt-2 flex items-center gap-2 text-[11.5px] text-[#c9a9ff]">
                        <Loader2 size={11} className="animate-spin" />
                        Retrying automatically in {retryIn}s — or press Retry to try now.
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setAutoTries(0);
                          setRetryIn(0);
                          run(resultText || text);
                        }}
                        className="btn-glass flex items-center gap-1.5 px-3.5 py-2 text-[11.5px] text-white/80"
                      >
                        {error.kind === "quota" && retryIn > 0 && (
                          <Loader2 size={11} className="animate-spin text-[#c9a9ff]" />
                        )}
                        Retry now
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setModalOpen(true)}
                        className="btn-ghost px-3 py-1.5 text-[11.5px] text-white/55 hover:text-white"
                      >
                        Check API key
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        disabled={diag?.running}
                        onClick={async () => {
                          setDiag({ running: true, detail: "", ok: false });
                          const out = await testConnection(apiKey);
                          setDiag({ running: false, detail: out.detail, ok: out.ok });
                        }}
                        className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] text-white/55 hover:text-white disabled:opacity-50"
                      >
                        {diag?.running && <Loader2 size={11} className="animate-spin" />}
                        Test connection
                      </motion.button>
                    </div>
                  {diag && !diag.running && diag.detail && (
                    <p
                      className="mt-2.5 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed"
                      style={{
                        borderColor:
                          theme === "light"
                            ? diag.ok
                              ? "rgba(16,140,90,0.3)"
                              : "rgba(194,37,92,0.25)"
                            : diag.ok
                              ? "rgba(140,230,190,0.25)"
                              : "rgba(255,120,150,0.2)",
                        background:
                          theme === "light"
                            ? diag.ok
                              ? "rgba(16,140,90,0.08)"
                              : "rgba(194,37,92,0.06)"
                            : diag.ok
                              ? "rgba(90,220,170,0.06)"
                              : "rgba(255,80,110,0.05)",
                        color:
                          theme === "light"
                            ? diag.ok
                              ? "rgba(8,90,60,0.95)"
                              : "rgba(130,20,60,0.95)"
                            : diag.ok
                              ? "rgba(160,240,205,0.9)"
                              : "rgba(255,255,255,0.6)",
                      }}
                    >                        {diag.detail}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* result body */}
            {result && !loading && (
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: EASE }}
                  className="liquid-card card-lift mt-3.5 overflow-hidden"
                >
                  <div className="proof">
                    <div className="px-6 py-6 sm:px-7">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9a9ff]">
                          {proofLabels.en}
                        </span>
                        <span className="font-bangla text-[10.5px] text-white/35">{proofLabels.enBn}</span>
                      </div>
                      <p className="mt-3 text-[16px] leading-relaxed text-white/90">
                        {result.base_translations.english}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <CopyChip text={result.base_translations.english} />
                      </div>
                    </div>
                    <div className="px-6 py-6 sm:px-7">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bangla text-[11px] font-semibold text-[#c9a9ff]">{proofLabels.bn}</span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">{proofLabels.bnBn}</span>
                      </div>
                      <p className="font-bangla mt-3 text-[15.5px] leading-relaxed text-white/85">
                        {result.base_translations.bangla}
                      </p>
                      <div className="mt-3 flex justify-end">
                        <CopyChip text={result.base_translations.bangla} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.section>
        </div>

        {/* ------------------------------- registers ------------------------------ */}
        {result && !loading && (
          <motion.section {...fadeUp()} className="mt-10">
            <div className="flex items-baseline justify-between">
              <div className="step-tag">
                <span>Semantic registers</span>
                <span className="bn bn-strong font-bangla">তেরো রূপ</span>
              </div>
              <span className="shrink-0 text-[10.5px] text-white/35">
                {visibleTones.length} of {TONES.length}
              </span>
            </div>

            {/* filter chips */}
            <div className="mt-3.5 flex flex-wrap gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTone("all")}
                className={`rounded-full px-3.5 py-1.5 text-[11px] transition-colors duration-300 ${
                  activeTone === "all"
                    ? "border border-[rgba(178,75,243,0.5)] bg-[rgba(143,69,245,0.16)] text-white"
                    : "border border-white/10 bg-white/[0.04] text-white/50 hover:text-white"
                }`}
              >
                All · সব
              </motion.button>
              {TONES.map((t) => (
                <motion.button
                  key={t.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTone(activeTone === t.key ? "all" : t.key)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] transition-colors duration-300 ${
                    activeTone === t.key
                      ? "border border-[rgba(178,75,243,0.5)] bg-[rgba(143,69,245,0.16)] text-white"
                      : "border border-white/10 bg-white/[0.04] text-white/50 hover:text-white"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.accent }} />
                  {t.label}
                </motion.button>
              ))}
            </div>

            {/* register list */}
            <div className="liquid-card mt-3.5 overflow-hidden">
              <div className="tone-list">
                <AnimatePresence initial={false}>
                  {visibleTones.map((t, i) => (
                    <ToneRow
                      key={t.key}
                      label={t.label}
                      bn={t.bn}
                      accent={t.accent}
                      icon={t.icon}
                      index={i}
                      en={result.semantics[t.key].english}
                      bnText={result.semantics[t.key].bangla}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.section>
        )}

        {/* ------------------------------- samples -------------------------------- */}
        <motion.section {...fadeUp()} className="mt-10">
          <div className="text-center">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.26em] text-white/30">
              Try a sample · একটি নমুনা
            </span>
          </div>
          <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
            {SAMPLES.map((s, i) => (
              <motion.button
                key={s.label}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setText(s.text);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="liquid-card card-lift px-5 py-4 text-left"
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: LANG_META[detectLanguage(s.text)].dot,
                      boxShadow: `0 0 8px ${LANG_META[detectLanguage(s.text)].dot}88`,
                    }}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    {s.label}
                  </span>
                </div>
                <p className="font-bangla mt-2.5 text-[13px] leading-relaxed text-white/70">{s.text}</p>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* -------------------------------- recent -------------------------------- */}
        {history.length > 0 && (
          <motion.section {...fadeUp()} className="mt-10 pb-10">
            <div className="flex items-center justify-between">
              <StepTag en="Recent" bn="সাম্প্রতিক" />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setHistory([])}
                className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 text-[10.5px] text-white/40 hover:text-white"
              >
                <Trash2 size={11} />
                Clear all
              </motion.button>
            </div>
            <div className="liquid-card mt-3.5 overflow-hidden">
              {history.slice(0, 6).map((h, i) => (
                <div
                  key={h.ts}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setText(h.text);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setText(h.text);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className={`group flex w-full cursor-pointer items-center gap-3 px-6 py-3.5 text-left transition-colors duration-300 hover:bg-white/[0.04] ${
                    i ? "border-t border-white/5" : ""
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LANG_META[h.lang].dot }} />
                  <span className="font-bangla min-w-0 flex-1 truncate text-[13px] text-white/55 transition-colors duration-300 group-hover:text-white/85">
                    {h.text}
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistory((hist) => hist.filter((x) => x.ts !== h.ts));
                    }}
                    className="shrink-0 rounded-full p-1.5 text-white/25 opacity-70 transition-colors duration-300 hover:bg-[rgba(255,120,150,0.1)] hover:text-[#ff9db4] group-hover:opacity-100"
                    aria-label={`Remove “${h.text.slice(0, 30)}” from recent`}
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </motion.button>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </div>

      {/* -------------------------------- footer -------------------------------- */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.25 }}
        className="site-footer"
      >
        <div className="mx-auto max-w-[1080px] px-4 pb-9 pt-10 sm:px-6 sm:pt-12">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="liquid-logo flex h-10 w-10 items-center justify-center">
                <Languages size={17} className="text-[#fff]" />
              </div>
              <div>
                <div className="font-display text-[16px] font-bold leading-tight text-white">Rupantor</div>
                <div className="font-bangla-display text-[12.5px] leading-tight text-white/45">
                  রূপান্তর — এক ভাষা, অনেক রূপ
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href="https://aistudio.google.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="key-pill group flex items-center gap-1.5 px-3.5 py-2 text-[11.5px] text-white/60 transition-colors duration-300 hover:text-white"
              >
                <KeyRound size={12} className="text-[#c9a9ff]" />
                Get a free API key
                <ArrowUpRight size={11} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <a
                href="https://ai.google.dev/gemini-api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="key-pill group flex items-center gap-1.5 px-3.5 py-2 text-[11.5px] text-white/60 transition-colors duration-300 hover:text-white"
              >
                <Sparkles size={12} className="text-[#c9a9ff]" />
                Gemini API docs
                <ArrowUpRight size={11} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>

          <div className="my-8 flex items-center gap-4">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(178,75,243,0.35)]" />
            <Sparkles size={12} className="shrink-0 text-[#b24bf3]" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(178,75,243,0.35)]" />
          </div>

          <div className="flex flex-col items-center gap-2.5 pb-2 text-center">
          <a
            href="https://github.com/nafisalamkhan/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Nafis Alam Khan — GitHub profile"
            className="group inline-flex items-center gap-2.5 pb-1"
          >
            <Github size={19} className="text-white/50 transition-colors duration-300 group-hover:text-[#c9a9ff]" />
            <span className="font-display text-[14px] font-semibold tracking-wide text-white/80 transition-colors duration-300 group-hover:text-white">
              Nafis Alam Khan
            </span>
          </a>
          <p className="font-bangla pb-1 text-[11px] text-white/30">
            © {new Date().getFullYear()} রূপান্তর · All rights reserved
          </p>
          </div>
        </div>
      </motion.footer>

      {/* --------------------------------- toast --------------------------------- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2"
          >
            <div
              className="liquid-soft flex items-center gap-2 px-4 py-2.5 text-[12px]"
              style={{ color: toast.kind === "err" ? "#ff9db4" : "rgba(255,255,255,0.85)" }}
            >
              {toast.kind === "err" ? <AlertTriangle size={13} /> : <Check size={13} className="text-[#c9a9ff]" />}
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ApiKeyModal
        open={modalOpen}
        storedKey={apiKey}
        onClose={() => setModalOpen(false)}
        onSave={(k) => {
          setApiKey(k);
          try {
            localStorage.setItem("rupantor:api-key", k);
          } catch { /* private mode */ }
          setModalOpen(false);
          showToast("API key saved — conversions are live");
        }}
        onRemove={() => {
          setApiKey("");
          try {
            localStorage.removeItem("rupantor:api-key");
          } catch { /* private mode */ }
          setModalOpen(false);
          showToast("API key removed", "err");
        }}
      />
    </>
  );
}

/* ----------------------------- crash safety ----------------------------- */

class Boundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="app-shell">
          <Background />
          <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
            <div className="liquid-card max-w-md p-8 text-center">
              <AlertTriangle size={22} className="mx-auto text-[#ff9db4]" />
              <h2 className="font-display mt-3 text-lg font-bold text-white">Something broke</h2>
              <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">
                An unexpected error crashed the interface. Your API key and history are safe — they live
                only in this browser.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => window.location.reload()}
                className="btn-primary mx-auto mt-5 px-5 py-2.5 text-[13px] font-semibold"
              >
                Reload Rupantor
              </motion.button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <Boundary>
      <Converter />
    </Boundary>
  );
}

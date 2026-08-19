import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const KEY_STORAGE = "rupantor:api-key";

export function readStoredKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

/* Practical check: AI Studio keys are long, dense, space-free strings. We
   deliberately do NOT require a specific prefix. */
export function looksLikeKey(k: string): boolean {
  const t = k.trim();
  return t.length >= 20 && !/\s/.test(t);
}

const spring = { type: "spring", stiffness: 220, damping: 22 } as const;

interface ApiKeyModalProps {
  open: boolean;
  storedKey: string;
  onClose: () => void;
  onSave: (key: string) => void;
  onRemove: () => void;
}

export default function ApiKeyModal({ open, storedKey, onClose, onSave, onRemove }: ApiKeyModalProps) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (open) {
      setValue(storedKey);
      setError("");
      setShow(false);
    }
  }, [open, storedKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = value.trim();
    if (!looksLikeKey(clean)) {
      setError("That doesn't look right — paste the full key from Google AI Studio (a long string, no spaces).");
      setShake((s) => s + 1);
      return;
    }
    onSave(clean);
  };

  const masked = storedKey.length > 12 ? `${storedKey.slice(0, 6)}…${storedKey.slice(-4)}` : storedKey;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 36, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={spring}
            className="modal-panel w-full max-w-md"
          >
            <div className="liquid-card p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="liquid-logo flex h-10 w-10 items-center justify-center">
                    <KeyRound size={17} className="text-[#fff]" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-white">Google API key</h2>
                    <p className="mt-0.5 text-[11px] text-white/45">Powers every conversion · stored only in this browser</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="btn-ghost p-2 text-white/50 hover:text-white"
                  aria-label="Close"
                >
                  <X size={15} />
                </motion.button>
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-medium uppercase tracking-[0.14em] text-white/40">API key</span>
                    {storedKey && !value && <span className="text-white/35">saved · {masked}</span>}
                  </div>
                  <motion.div
                    key={shake}
                    animate={shake ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
                    transition={{ duration: 0.35 }}
                    className="glass-input flex items-center gap-2 px-3.5 py-2.5"
                  >
                    <input
                      autoFocus
                      type={show ? "text" : "password"}
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Paste your key from Google AI Studio"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="text-white/40 transition-colors hover:text-white"
                      aria-label={show ? "Hide key" : "Show key"}
                    >
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </motion.div>
                  {error ? (
                    <p className="mt-1.5 text-[11px] text-[#ff9db4]">{error}</p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-white/35">
                      Keys are long strings (often starting with <span className="text-white/55">AIza</span>) — any key from AI
                      Studio works with any model.
                    </p>
                  )}
                </div>

                <a
                  href="https://aistudio.google.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-input group flex items-center justify-between px-3.5 py-2.5 text-[12px] text-white/60 transition-colors hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={13} className="text-[#c9a9ff]" />
                    Don't have a key? Get one free at Google AI Studio
                  </span>
                  <ArrowUpRight size={13} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>

                <div className="flex items-center gap-2 pt-1">
                  {storedKey && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={onRemove}
                      className="btn-ghost flex items-center gap-1.5 px-3 py-2.5 text-[12px] text-white/50 hover:text-[#ff9db4]"
                    >
                      <Trash2 size={13} />
                      Remove
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    className="btn-primary ml-auto flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold"
                  >
                    <ShieldCheck size={14} />
                    Save key
                  </motion.button>
                </div>

                <p className="flex items-center justify-center gap-1.5 border-t border-white/5 pt-3.5 text-center text-[10.5px] text-white/35">
                  <ShieldCheck size={11} className="text-[#c9a9ff]" />
                  Your key never leaves this browser — everything runs client-side
                </p>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

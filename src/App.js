import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, CheckCircle2, AlertCircle, Building2, Phone, Loader2,
  ChevronDown, ChevronRight, ChevronLeft, X, Info, User, MapPin,
  Home, Shield, Layers, Mail, ExternalLink, RotateCcw, Printer, Calendar, FileClock
} from "lucide-react";
import { ServiziStudio } from "./ServiziStudio";

// ─────────────────────────────────────────────────────────────
// Costanti
// ─────────────────────────────────────────────────────────────
const APP_VERSION = "1.4.1";
const BUILD_DATE_LABEL = "29/09/2026"; // Data fissa della release, non cambia ogni giorno
const WEBHOOK_URL = "https://hook.eu1.make.com/k8agbjzwobv0b2myrdwtu06ztjdefvx8";
const BRAND_NAME = "Studio CAI";
const LOGO_URL = "/logo.jpg";
const PRIMARY = "#8B1538";
const GDPR_URL = "https://www.dropbox.com/scl/fi/57wzvnnkfz96j3t6ts7r2/INFORMATIVA-SUL-TRATTAMENTO-DEI-DATI-PERSONALI.pdf?rlkey=mhkez37u9gtlxoycajz8wzxn3&dl=0";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const cn = (...cls) => cls.filter(Boolean).join(" ");

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim());

// Codice fiscale: formato (con omocodia) + carattere di controllo
const CF_ODD = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const cfEven = (c) => (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65);
const CF_RE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
const isValidCF = (cf) => {
  if (!cf || cf.length !== 16 || !CF_RE.test(cf)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) sum += i % 2 === 0 ? CF_ODD[cf[i]] : cfEven(cf[i]);
  return String.fromCharCode(65 + (sum % 26)) === cf[15];
};
const cfError = (cf) => {
  if (!cf) return null;
  if (cf.length < 16) return "Il codice fiscale deve avere 16 caratteri";
  if (!isValidCF(cf)) return "Codice fiscale non corretto: controlla di averlo digitato bene";
  return null;
};

// Bozza salvata sul dispositivo (scade dopo 7 giorni)
const DRAFT_KEY = "studiocai-anagrafe-bozza";
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
const readDraft = () => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (!d || !d.form || Date.now() - d.savedAt > DRAFT_TTL) { localStorage.removeItem(DRAFT_KEY); return null; }
    return d;
  } catch { return null; }
};
const writeDraft = (form, step) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: { ...form, consenso: false }, step, savedAt: Date.now() })); } catch {}
};
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };
const isFormEmpty = (f) => {
  const base = initFormBase();
  return JSON.stringify({ ...f, consenso: false }) === JSON.stringify(base);
};

const S = {
  nome:      (v) => v.replace(/[^\p{L}\s'-]/gu, ""),
  luogo:     (v) => v.replace(/[^\p{L}\s',-]/gu, ""),
  indirizzo: (v) => v.replace(/[^\p{L}\p{N}\s.,'/°-]/gu, ""),
  comune:    (v) => v.replace(/[^\p{L}\s'-]/gu, ""),
  cf:        (v) => v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16),
  telefono:  (v) => v.replace(/[^\d\s+]/g, ""),
  email:     (v) => v.replace(/\s/g, ""),
  foglio:    (v) => v.replace(/[^\p{L}\p{N}]/gu, ""),
  interno:   (v) => v.replace(/[^\p{L}\p{N}]/gu, ""),
  scala:     (v) => v.replace(/[^\p{L}\p{N}]/gu, ""),
  piano:     (v) => v.replace(/[^\p{L}\p{N}°]/gu, ""),
  zona:      (v) => v.replace(/[^\p{L}\p{N}]/gu, ""),
  perc:      (v) => v.replace(/[^\d.,]/g, ""),
  cap:       (v) => v.replace(/\D/g, "").slice(0, 5),
  prov:      (v) => v.replace(/[^\p{L}]/gu, "").toUpperCase().slice(0, 2),
};

const DESTINAZIONI = ["Abitazione", "Negozio", "Ufficio", "Autorimessa", "Posto auto", "Cantina", "Altro"];
const QUALITA_PF = ["Unico Proprietario", "Comproprietario", "Usufruttuario", "Nudo proprietario", "Titolare di altro diritto reale"];
const MODALITA = [
  { key: "racc_stesso", label: "Raccomandata a/r all'indirizzo di residenza comunicato" },
  { key: "racc_altro",  label: "Raccomandata a/r ad altro indirizzo" },
  { key: "pec",         label: "Posta Elettronica Certificata (PEC)" },
];

const emptyUnita = () => ({
  palazzina: "", scala: "", piano: "", interno: "",
  zona: "", foglio: "", particella: "", sub: "", classe: "", categoria: "",
  destinazione: "", destinazioneAltro: "",
});

const initForm = () => ({
  condominio: "",
  unita: [emptyUnita()],
  // Anagrafici
  nome: "", luogoNascita: "", dataNascita: "",
  comuneResidenza: "", indirizzoResidenza: "",
  codiceFiscale: "",
  comuneDomicilio: "", indirizzoDomicilio: "",
  qualitaPF: "", percentuale: "", altroDiritto: "",
  // Recapiti
  nomeRecapiti: "", tel1: "", tel2: "", tel3: "",
  email1: "", email2: "", email3: "",
  pec1: "", pec2: "", altroRecapito: "",
  // Corrispondenza
  modalita: "", indirizzoRacc: "", capRacc: "", cittaRacc: "", provRacc: "",
  // Consenso
  consenso: false,
});

const initFormBase = () => initForm();

const STEPS = [
  { id: 1, label: "Condominio e unità", icon: Home },
  { id: 2, label: "Dati anagrafici",    icon: User },
  { id: 3, label: "Recapiti",           icon: Phone },
  { id: 4, label: "Corrispondenza",     icon: Mail },
  { id: 5, label: "Riepilogo",          icon: Shield },
];

// ─────────────────────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────────────────────
export default function AppAnagrafe() {
  const [form, setForm]         = useState(initForm());
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState(null);
  const [touched, setTouched]   = useState({});
  const [showInfo, setShowInfo] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [step, setStep]         = useState(1);
  const [sent, setSent]         = useState(null); // dati della scheda appena inviata → schermata finale
  const [draft, setDraft]       = useState(() => readDraft()); // compilazione in sospeso trovata all'apertura

  // Salvataggio automatico della compilazione (solo dopo aver scelto se riprendere l'eventuale bozza)
  React.useEffect(() => {
    if (draft || sent) return;
    if (isFormEmpty(form)) return;
    const t = setTimeout(() => writeDraft(form, step), 400);
    return () => clearTimeout(t);
  }, [form, step, draft, sent]);

  // Con una bozza in sospeso la pagina si apre dall'alto, così l'avviso è subito visibile
  React.useEffect(() => {
    if (!draft) return;
    try { if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual"; } catch {}
    window.scrollTo(0, 0);
  }, []);

  const riprendiBozza = () => {
    setForm({ ...initForm(), ...draft.form, consenso: false });
    setStep(draft.step || 1);
    setDraft(null);
  };
  const scartaBozza = () => { clearDraft(); setDraft(null); };

  React.useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const cssVars = useMemo(() => ({ "--brand": PRIMARY }), []);

  // ─── State helpers ───
  const upd = (k, raw) => {
    const clean = S[k] ? S[k](raw) : raw;
    setForm((s) => ({ ...s, [k]: clean }));
    setTouched((t) => ({ ...t, [k]: true }));
  };
  const updRaw = (k, v) => {
    setForm((s) => ({ ...s, [k]: v }));
    setTouched((t) => ({ ...t, [k]: true }));
  };
  const updU = (idx, k, raw) => {
    const clean = S[k] ? S[k](raw) : raw;
    setForm((s) => {
      const u = [...s.unita];
      u[idx] = { ...u[idx], [k]: clean };
      return { ...s, unita: u };
    });
    setTouched((t) => ({ ...t, [`u_${idx}_${k}`]: true }));
  };
  const addU = () => {
    if (form.unita.length < 3) {
      setForm((s) => ({ ...s, unita: [...s.unita, emptyUnita()] }));
    }
  };
  const remU = (i) => {
    if (form.unita.length > 1) {
      setForm((s) => ({ ...s, unita: s.unita.filter((_, j) => j !== i) }));
    }
  };

  // ─── Errori singolo campo (per feedback in tempo reale) ───
  const err = (f) => {
    if (!touched[f]) return null;
    const v = form[f];
    const obbligatori = [
      "condominio", "nome", "comuneResidenza", "indirizzoResidenza",
      "luogoNascita", "dataNascita", "codiceFiscale", "qualitaPF",
      "nomeRecapiti", "tel1", "email1", "modalita",
    ];
    if (obbligatori.includes(f) && !v) return "Campo obbligatorio";
    if (f === "codiceFiscale" && v) return cfError(v);
    if (f === "percentuale" && form.qualitaPF === "Comproprietario" && !v) return "Indica la percentuale";
    if (f === "altroDiritto" && form.qualitaPF === "Titolare di altro diritto reale" && !v) return "Specifica il titolo";
    if (["email1", "email2", "email3", "pec1", "pec2"].includes(f) && v && !isValidEmail(v)) return "Indirizzo e-mail non valido";
    if (f === "pec1" && form.modalita === "pec" && !v) return "Inserisci l'indirizzo PEC";
    if (["indirizzoRacc", "capRacc", "cittaRacc"].includes(f) && form.modalita === "racc_altro" && !v) return "Campo obbligatorio";
    return null;
  };

  const errU = (i, f) => {
    const key = `u_${i}_${f}`;
    if (!touched[key]) return null;
    const v = form.unita[i]?.[f];
    if (f === "destinazione" && !v) return "Seleziona la destinazione";
    if (f === "destinazioneAltro" && form.unita[i]?.destinazione === "Altro" && !v) return "Specifica";
    return null;
  };

  // ─── Validazione completa per step ───
  const validateStep = (s) => {
    const e = [];
    if (s === 1) {
      if (!form.condominio) e.push("Inserisci il nome o l'indirizzo del condominio");
      form.unita.forEach((u, i) => {
        if (!u.destinazione) e.push(`Seleziona la destinazione per l'unità ${i + 1}`);
        if (u.destinazione === "Altro" && !u.destinazioneAltro) e.push(`Specifica la destinazione per l'unità ${i + 1}`);
      });
    }
    if (s === 2) {
      if (!form.nome) e.push("Inserisci nome e cognome");
      if (!form.codiceFiscale) e.push("Inserisci il codice fiscale");
      else if (cfError(form.codiceFiscale)) e.push(cfError(form.codiceFiscale));
      if (!form.luogoNascita) e.push("Inserisci luogo di nascita");
      if (!form.dataNascita) e.push("Inserisci data di nascita");
      if (!form.comuneResidenza) e.push("Inserisci comune di residenza");
      if (!form.indirizzoResidenza) e.push("Inserisci indirizzo di residenza");
      if (!form.qualitaPF) e.push("Seleziona la qualità del dichiarante");
      if (form.qualitaPF === "Comproprietario" && !form.percentuale) e.push("Indica la percentuale di comproprietà");
      if (form.qualitaPF === "Titolare di altro diritto reale" && !form.altroDiritto) e.push("Specifica il titolo del diritto reale");
    }
    if (s === 3) {
      if (!form.nomeRecapiti) e.push("Inserisci il nome del titolare dei recapiti");
      if (!form.tel1) e.push("Inserisci almeno un numero di telefono");
      if (!form.email1) e.push("Inserisci almeno un indirizzo e-mail");
      if (form.email1 && !isValidEmail(form.email1)) e.push("E-mail 1 non valida");
      if (form.email2 && !isValidEmail(form.email2)) e.push("E-mail 2 non valida");
      if (form.email3 && !isValidEmail(form.email3)) e.push("E-mail 3 non valida");
      if (form.pec1 && !isValidEmail(form.pec1)) e.push("PEC 1 non valida");
      if (form.pec2 && !isValidEmail(form.pec2)) e.push("PEC 2 non valida");
    }
    if (s === 4) {
      if (!form.modalita) e.push("Seleziona la modalità di corrispondenza");
      if (form.modalita === "racc_altro") {
        if (!form.indirizzoRacc) e.push("Inserisci l'indirizzo raccomandata");
        if (!form.capRacc) e.push("Inserisci il CAP");
        if (!form.cittaRacc) e.push("Inserisci la città");
      }
      if (form.modalita === "pec" && !form.pec1) e.push("Inserisci l'indirizzo PEC");
    }
    if (s === 5) {
      if (!form.consenso) e.push("Conferma la presa visione dell'informativa privacy");
    }
    return e;
  };

  // ─── Touch tutti i campi dello step ───
  const touchStep = (s) => {
    const t = {};
    if (s === 1) {
      t["condominio"] = true;
      form.unita.forEach((_, i) => {
        ["destinazione", "destinazioneAltro"].forEach((f) => { t[`u_${i}_${f}`] = true; });
      });
    }
    if (s === 2) {
      ["nome", "codiceFiscale", "luogoNascita", "dataNascita",
       "comuneResidenza", "indirizzoResidenza", "qualitaPF",
       "percentuale", "altroDiritto"].forEach((f) => { t[f] = true; });
    }
    if (s === 3) {
      ["nomeRecapiti", "tel1", "email1", "email2", "email3", "pec1", "pec2"].forEach((f) => { t[f] = true; });
    }
    if (s === 4) {
      ["modalita", "indirizzoRacc", "capRacc", "cittaRacc", "pec1"].forEach((f) => { t[f] = true; });
    }
    if (s === 5) {
      ["consenso"].forEach((f) => { t[f] = true; });
    }
    setTouched((prev) => ({ ...prev, ...t }));
  };

  const goNext = () => {
    touchStep(step);
    const errs = validateStep(step);
    if (errs.length) { setResult({ ok: false, error: errs[0] }); return; }
    setResult(null);
    if (step === 2 && !form.nomeRecapiti && form.nome) {
      setForm((f) => ({ ...f, nomeRecapiti: f.nome }));
    }
    setStep((s) => Math.min(s + 1, 5));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goPrev = () => {
    setResult(null);
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (cooldown) return;
    touchStep(5);
    const allErrs = [1, 2, 3, 4, 5].flatMap((s) => validateStep(s));
    if (allErrs.length) { setResult({ ok: false, error: allErrs[0] }); return; }
    setSending(true);
    setResult(null);
    const ticket = `ANA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    try {
      const fd = new FormData();
      const payload = {
        ...form,
        unita: JSON.stringify(form.unita),
        ticket,
        timestamp: new Date().toISOString(),
        appVersion: APP_VERSION,
        tipo: "anagrafe_condominiale",
      };
      Object.entries(payload).forEach(([k, v]) => fd.append(k, String(v)));
      const res = await fetch(WEBHOOK_URL, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Schermata finale di conferma: resta visibile finché l'utente non sceglie di compilare una nuova scheda
      setSent({
        quando: new Date().toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" }),
        dati: { ...form, unita: form.unita.map((u) => ({ ...u })) },
      });
      setResult(null);
      clearDraft();
      setCooldown(10);
      setForm(initForm());
      setTouched({});
      setStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error("Invio anagrafe non riuscito:", e);
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setResult({
        ok: false,
        error: offline
          ? "Sembra che il dispositivo non sia connesso a Internet. Controlla la connessione e premi di nuovo \"Invia scheda\": i dati inseriti non sono andati persi."
          : "Invio non riuscito. Riprova tra qualche istante: i dati inseriti non sono andati persi. Se il problema continua chiama lo studio allo 06 7835 9769.",
      });
    } finally {
      setSending(false);
    }
  };

  const nuovaScheda = () => {
    setSent(null);
    setResult(null);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen w-full bg-paper bg-noise text-neutral-900" style={cssVars}>
      {/* Background blobs */}
      <div aria-hidden="true" className="no-print pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-brand/10 blur-3xl" />
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-neutral-200/70">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white ring-1 ring-neutral-200 shadow-soft flex items-center justify-center">
                {LOGO_URL
                  ? <img src={LOGO_URL} alt="logo" className="w-full h-full object-contain p-1" />
                  : <Building2 className="w-8 h-8 text-brand" />}
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand ring-2 ring-white flex items-center justify-center">
                <Shield className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-semibold text-xl sm:text-2xl text-neutral-900 truncate">{BRAND_NAME}</h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white tracking-wider">v{APP_VERSION}</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-600 mt-0.5">Anagrafe condominiale</p>
            </div>
            <button onClick={() => setShowInfo(!showInfo)} className="p-2.5 rounded-xl hover:bg-neutral-100 active:bg-neutral-200 transition-colors" aria-label="Informazioni">
              <Info className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Info panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="relative z-10 bg-gradient-to-b from-brand/8 to-brand/[0.04] border-b border-brand/20"
          >
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
              <p className="text-sm text-neutral-700 flex-1">
                Compila le 5 sezioni guidate per registrare i tuoi dati nel Registro Anagrafe Condominiale.
                I campi con <span className="text-red-500 font-bold">*</span> sono obbligatori. Al termine potrai rivedere tutto prima di inviare.
              </p>
              <button onClick={() => setShowInfo(false)} className="p-1.5 hover:bg-brand/10 rounded-lg">
                <X className="w-4 h-4 text-brand" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-10">

        {sent ? (
          <ConfermaInvio sent={sent} onNuova={nuovaScheda} cooldown={cooldown} />
        ) : (<>
        {/* Compilazione in sospeso */}
        <AnimatePresence>
          {draft && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="mb-5 rounded-2xl bg-white ring-1 ring-brand/25 shadow-soft p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">
                  <FileClock className="w-5 h-5" />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-neutral-900">Hai una compilazione non terminata</p>
                  <p className="text-sm text-neutral-600 mt-0.5">
                    Salvata su questo dispositivo il {new Date(draft.savedAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                    {draft.form?.condominio ? <> · {draft.form.condominio}</> : null}. Vuoi riprendere da dove eri rimasto?
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={riprendiBozza}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand to-brand-dark text-white text-sm font-semibold shadow hover:shadow-md transition-all">
                      Riprendi
                    </button>
                    <button onClick={scartaBozza}
                      className="px-4 py-2 rounded-xl border-2 border-neutral-200 text-neutral-700 text-sm font-semibold hover:border-neutral-300 hover:bg-neutral-50 transition-all">
                      Ricomincia da capo
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress */}
        <div className="mb-6">
          <div className="hidden sm:flex items-center justify-between mb-2">
            {STEPS.map((s) => (
              <div key={s.id} className={cn(
                "flex items-center gap-1.5 text-xs font-semibold transition-colors",
                step === s.id ? "text-brand" : step > s.id ? "text-neutral-500" : "text-neutral-300"
              )}>
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 transition-all",
                  step === s.id ? "bg-brand text-white ring-brand" :
                  step > s.id  ? "bg-neutral-200 text-neutral-600 ring-neutral-200" :
                                 "bg-white text-neutral-300 ring-neutral-200"
                )}>
                  {step > s.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.id}
                </span>
                {s.label}
              </div>
            ))}
          </div>
          <div className="flex sm:hidden items-center justify-between mb-2">
            <span className="text-sm font-semibold text-brand">{STEPS[step - 1].label}</span>
            <span className="text-xs text-neutral-500 font-medium">Passo {step} di {STEPS.length}</span>
          </div>
          <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-brand to-brand-dark rounded-full"
              animate={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Errore globale */}
        <AnimatePresence>
          {result && !result.ok && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 flex-1">{result.error}</p>
              <button onClick={() => setResult(null)}><X className="w-4 h-4 text-red-400" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card */}
        <motion.div
          layout
          className="bg-white rounded-3xl shadow-lift overflow-hidden ring-1 ring-neutral-200/80"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        >
          {/* Card header bordeaux */}
          <div className="relative overflow-hidden bg-gradient-to-br from-brand via-brand-dark to-brand-deep px-6 sm:px-8 py-5">
            <div aria-hidden="true" className="absolute inset-0 opacity-20"
              style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "32px 32px", backgroundPosition: "0 0, 16px 16px" }}
            />
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
                {React.createElement(STEPS[step - 1].icon, { className: "w-5 h-5 text-white" })}
              </div>
              <div>
                <p className="text-white/60 text-xs font-mono font-bold uppercase tracking-widest">Passo {step} di {STEPS.length}</p>
                <h2 className="font-display font-semibold text-xl text-white leading-tight">{STEPS[step - 1].label}</h2>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >

                {/* ════════════════════════════════════════
                    STEP 1 — Condominio e Unità immobiliari
                ════════════════════════════════════════ */}
                {step === 1 && (
                  <div className="space-y-6">
                    <p className="text-sm text-neutral-600">
                      Indica prima il condominio di riferimento, poi inserisci i dati delle tue unità immobiliari. Puoi aggiungerne fino a 3.
                    </p>

                    {/* Campo condominio */}
                    <TF
                      label="Condominio"
                      required
                      value={form.condominio}
                      onChange={(v) => upd("condominio", v)}
                      placeholder="Es. Via Marco Polo 84, Roma"
                      icon={<Building2 className="w-4 h-4" />}
                      error={err("condominio")}
                      hint="Nome e/o indirizzo del condominio di riferimento"
                      sanitizerKey="indirizzo"
                    />

                    {/* Unità */}
                    {form.unita.map((u, idx) => (
                      <div key={idx} className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-brand uppercase tracking-wider">{idx + 1}ª Unità</span>
                          {form.unita.length > 1 && (
                            <button onClick={() => remU(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            ["palazzina", "Palazzina", "A",  "scala"],
                            ["scala",     "Scala",     "1",  "scala"],
                            ["piano",     "Piano",     "3°", "piano"],
                            ["interno",   "Interno",   "5",  "interno"],
                          ].map(([k, l, p, sk]) => (
                            <TF key={k} label={l} value={u[k]} onChange={(v) => updU(idx, k, v)} placeholder={p} sanitizerKey={sk} />
                          ))}
                        </div>

                        <div>
                          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Dati catastali <span className="font-normal normal-case">(se disponibili)</span></p>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            {[
                              ["zona",       "Zona"],
                              ["foglio",     "Foglio"],
                              ["particella", "Partic."],
                              ["sub",        "Sub"],
                              ["classe",     "Classe"],
                              ["categoria",  "Categ."],
                            ].map(([k, l]) => (
                              <TF key={k} label={l} value={u[k]} onChange={(v) => updU(idx, k, v)} placeholder="—" sanitizerKey="foglio" />
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <SF
                            label="Destinazione d'uso"
                            required
                            value={u.destinazione}
                            onChange={(v) => {
                              updU(idx, "destinazione", v);
                              if (v !== "Altro") updU(idx, "destinazioneAltro", "");
                            }}
                            options={DESTINAZIONI}
                            error={errU(idx, "destinazione")}
                          />
                          {u.destinazione === "Altro" && (
                            <TF
                              label="Specifica destinazione"
                              required
                              value={u.destinazioneAltro}
                              onChange={(v) => updU(idx, "destinazioneAltro", v)}
                              placeholder="Es. magazzino"
                              error={errU(idx, "destinazioneAltro")}
                              sanitizerKey="luogo"
                            />
                          )}
                        </div>
                      </div>
                    ))}

                    {form.unita.length < 3 && (
                      <button
                        onClick={addU}
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl border-2 border-dashed border-brand/30 text-brand text-sm font-semibold hover:border-brand/60 hover:bg-brand/5 transition-all"
                      >
                        <Layers className="w-4 h-4" />Aggiungi un'altra unità
                      </button>
                    )}
                  </div>
                )}

                {/* ════════════════════════════════════════
                    STEP 2 — Dati anagrafici
                ════════════════════════════════════════ */}
                {step === 2 && (
                  <div className="space-y-5">
                    <p className="text-sm text-neutral-600">Inserisci i tuoi dati anagrafici come intestatario dell'unità immobiliare.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <TF label="Nome e Cognome" required value={form.nome} onChange={(v) => upd("nome", v)}
                          placeholder="Es. Rossi Mario" icon={<User className="w-4 h-4" />} error={err("nome")} sanitizerKey="nome" />
                      </div>
                      <TF label="Luogo di nascita" required value={form.luogoNascita} onChange={(v) => upd("luogoNascita", v)}
                        placeholder="Es. Roma" error={err("luogoNascita")} sanitizerKey="luogo" />
                      <TF label="Data di nascita" required value={form.dataNascita} onChange={(v) => updRaw("dataNascita", v)}
                        type="date" error={err("dataNascita")} />
                      <TF label="Comune di residenza" required value={form.comuneResidenza} onChange={(v) => upd("comuneResidenza", v)}
                        placeholder="Es. Roma" icon={<MapPin className="w-4 h-4" />} error={err("comuneResidenza")} sanitizerKey="comune" />
                      <TF label="Indirizzo di residenza" required value={form.indirizzoResidenza} onChange={(v) => upd("indirizzoResidenza", v)}
                        placeholder="Es. Via Roma 10" error={err("indirizzoResidenza")} sanitizerKey="indirizzo" />
                      <div className="sm:col-span-2">
                        <TF label="Codice Fiscale" required value={form.codiceFiscale} onChange={(v) => upd("codiceFiscale", v)}
                          placeholder="RSSMRA80A01H501Z" error={err("codiceFiscale")} hint="16 caratteri" sanitizerKey="cf" />
                      </div>
                      <TF label="Comune di domicilio" value={form.comuneDomicilio} onChange={(v) => upd("comuneDomicilio", v)}
                        placeholder="Solo se diverso da residenza" sanitizerKey="comune" />
                      <TF label="Indirizzo di domicilio" value={form.indirizzoDomicilio} onChange={(v) => upd("indirizzoDomicilio", v)}
                        placeholder="Solo se diverso da residenza" sanitizerKey="indirizzo" />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">In qualità di</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <SF
                          label="Qualità"
                          required
                          value={form.qualitaPF}
                          onChange={(v) => {
                            updRaw("qualitaPF", v);
                            if (v !== "Comproprietario") updRaw("percentuale", "");
                            if (v !== "Titolare di altro diritto reale") updRaw("altroDiritto", "");
                          }}
                          options={QUALITA_PF}
                          error={err("qualitaPF")}
                        />
                        {form.qualitaPF === "Comproprietario" && (
                          <TF label="Percentuale %" required value={form.percentuale} onChange={(v) => upd("percentuale", v)}
                            placeholder="Es. 50" error={err("percentuale")} hint="Quota di proprietà" sanitizerKey="perc" />
                        )}
                        {form.qualitaPF === "Titolare di altro diritto reale" && (
                          <TF label="Specifica il diritto" required value={form.altroDiritto} onChange={(v) => upd("altroDiritto", v)}
                            placeholder="Es. diritto di superficie" error={err("altroDiritto")} sanitizerKey="luogo" />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ════════════════════════════════════════
                    STEP 3 — Recapiti
                ════════════════════════════════════════ */}
                {step === 3 && (
                  <div className="space-y-5">
                    <p className="text-sm text-neutral-600">
                      Fornisci i tuoi recapiti per le comunicazioni condominiali. Telefono ed e-mail principale sono obbligatori.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <TF label="Nome e Cognome titolare recapiti" required value={form.nomeRecapiti} onChange={(v) => upd("nomeRecapiti", v)}
                          placeholder="Es. Rossi Mario" icon={<User className="w-4 h-4" />} error={err("nomeRecapiti")} sanitizerKey="nome" />
                      </div>
                      <TF label="N. telefono 1" required value={form.tel1} onChange={(v) => upd("tel1", v)}
                        placeholder="Es. 06 7835 9769" icon={<Phone className="w-4 h-4" />} error={err("tel1")} sanitizerKey="telefono" />
                      <TF label="N. telefono 2" value={form.tel2} onChange={(v) => upd("tel2", v)}
                        placeholder="Facoltativo" sanitizerKey="telefono" />
                      <TF label="N. telefono 3" value={form.tel3} onChange={(v) => upd("tel3", v)}
                        placeholder="Facoltativo" sanitizerKey="telefono" />
                      <TF label="E-mail 1" required value={form.email1} onChange={(v) => upd("email1", v)}
                        placeholder="nome@email.it" type="email" icon={<Mail className="w-4 h-4" />} error={err("email1")} sanitizerKey="email" />
                      <TF label="E-mail 2" value={form.email2} onChange={(v) => upd("email2", v)}
                        placeholder="Facoltativo" type="email" error={err("email2")} sanitizerKey="email" />
                      <TF label="E-mail 3" value={form.email3} onChange={(v) => upd("email3", v)}
                        placeholder="Facoltativo" type="email" error={err("email3")} sanitizerKey="email" />
                      <TF label="PEC 1" value={form.pec1} onChange={(v) => upd("pec1", v)}
                        placeholder="nome@pec.it" type="email" error={err("pec1")} sanitizerKey="email" />
                      <TF label="PEC 2" value={form.pec2} onChange={(v) => upd("pec2", v)}
                        placeholder="Facoltativo" type="email" error={err("pec2")} sanitizerKey="email" />
                      <TF label="Altro recapito" value={form.altroRecapito} onChange={(v) => upd("altroRecapito", v)}
                        placeholder="Es. Fax, WhatsApp…" sanitizerKey="luogo" />
                    </div>
                  </div>
                )}

                {/* ════════════════════════════════════════
                    STEP 4 — Corrispondenza
                ════════════════════════════════════════ */}
                {step === 4 && (
                  <div className="space-y-5">
                    <p className="text-sm text-neutral-600">Scegli come preferisci ricevere le comunicazioni ufficiali del condominio.</p>

                    <div className="space-y-2">
                      {MODALITA.map((m) => (
                        <label key={m.key} className={cn(
                          "flex items-start gap-3 cursor-pointer p-4 rounded-2xl border-2 transition-all",
                          form.modalita === m.key
                            ? "border-brand bg-brand/5"
                            : "border-neutral-200 hover:border-neutral-300 bg-white"
                        )}>
                          <input
                            type="radio" name="modalita" value={m.key}
                            checked={form.modalita === m.key}
                            onChange={() => { updRaw("modalita", m.key); setTouched((t) => ({ ...t, modalita: true })); }}
                            className="sr-only"
                          />
                          <span className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                            form.modalita === m.key ? "border-brand bg-brand" : "border-neutral-300 bg-white"
                          )}>
                            {form.modalita === m.key && <span className="w-2 h-2 rounded-full bg-white block" />}
                          </span>
                          <span className={cn("text-sm font-medium", form.modalita === m.key ? "text-brand" : "text-neutral-700")}>
                            {m.label}
                          </span>
                        </label>
                      ))}
                      {touched["modalita"] && !form.modalita && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />Seleziona una modalità
                        </p>
                      )}
                    </div>

                    {form.modalita === "racc_altro" && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-3">
                          <TF label="Indirizzo" required value={form.indirizzoRacc} onChange={(v) => upd("indirizzoRacc", v)}
                            placeholder="Via e numero civico" icon={<MapPin className="w-4 h-4" />} error={err("indirizzoRacc")} sanitizerKey="indirizzo" />
                        </div>
                        <TF label="CAP" required value={form.capRacc} onChange={(v) => upd("capRacc", v)}
                          placeholder="00100" error={err("capRacc")} sanitizerKey="cap" />
                        <TF label="Città" required value={form.cittaRacc} onChange={(v) => upd("cittaRacc", v)}
                          placeholder="Es. Roma" error={err("cittaRacc")} sanitizerKey="comune" />
                        <TF label="Prov" value={form.provRacc} onChange={(v) => upd("provRacc", v)}
                          placeholder="RM" sanitizerKey="prov" />
                      </motion.div>
                    )}

                    {form.modalita === "pec" && (
                      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                          Le comunicazioni via PEC hanno valore di raccomandata (D.P.R. n. 68/2005). Ci si impegna a comunicare ogni variazione.
                        </div>
                        <TF label="Indirizzo PEC" required value={form.pec1} onChange={(v) => upd("pec1", v)}
                          placeholder="nome@pec.it" type="email" error={err("pec1")} sanitizerKey="email" />
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ════════════════════════════════════════
                    STEP 5 — Riepilogo e consenso
                ════════════════════════════════════════ */}
                {step === 5 && (
                  <div className="space-y-5">
                    <p className="text-sm text-neutral-600">Verifica i dati inseriti prima di inviare la scheda.</p>

                    <RiepilogoDati f={form} />

                    {/* Privacy & Consenso */}
                    <div className="rounded-2xl bg-gradient-to-br from-neutral-50 to-white p-5 ring-1 ring-neutral-200 space-y-4">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-neutral-700 space-y-2">
                          <p className="font-semibold text-neutral-800">Informativa Privacy (GDPR)</p>
                          <p>
                            I dati saranno trattati ai sensi del Reg. UE 2016/679 e D.lgs. 196/03 per il Registro Anagrafe Condominiale (art. 10, comma 6, L. 220/2012). Il conferimento è obbligatorio. Il condomino è tenuto a comunicare ogni variazione entro 60 gg (art. 1130 c.c.).
                          </p>
                          <a href={GDPR_URL} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-brand font-semibold hover:underline text-xs">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Leggi l'informativa completa sul trattamento dei dati personali
                          </a>
                        </div>
                      </div>
                      <label className="flex items-start gap-3 cursor-pointer group pt-1">
                        <div className="pt-0.5">
                          <input type="checkbox" checked={form.consenso} onChange={(e) => updRaw("consenso", e.target.checked)} className="sr-only" />
                          <span className={cn(
                            "w-5 h-5 rounded-md ring-1 flex items-center justify-center transition-all",
                            form.consenso ? "bg-brand ring-brand" : "bg-white ring-neutral-300 group-hover:ring-neutral-400"
                          )}>
                            {form.consenso && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                          </span>
                        </div>
                        <span className="text-sm text-neutral-700 flex-1 leading-relaxed">
                          Confermo di aver preso visione dell'informativa, di essere consapevole delle responsabilità penali per dichiarazioni false (DPR 445/2000, artt. 75-76), e autorizzo il trattamento dei dati per la gestione condominiale.
                          <span className="text-red-500 ml-0.5">*</span>
                        </span>
                      </label>
                    </div>

                  </div>
                )}

              </motion.div>
            </AnimatePresence>

            {/* ── Navigazione ── */}
            <div className={cn("flex gap-3 mt-8", step > 1 ? "justify-between" : "justify-end")}>
              {step > 1 && (
                <button onClick={goPrev}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-neutral-200 text-neutral-700 text-sm font-semibold hover:border-neutral-300 hover:bg-neutral-50 transition-all">
                  <ChevronLeft className="w-4 h-4" />Indietro
                </button>
              )}
              {step < 5 ? (
                <button onClick={goNext}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-brand to-brand-dark text-white text-sm font-semibold shadow hover:shadow-md transition-all">
                  Avanti<ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <motion.button
                  disabled={sending || cooldown > 0}
                  onClick={submit}
                  whileHover={!sending && !cooldown ? { scale: 1.01 } : {}}
                  whileTap={!sending && !cooldown ? { scale: 0.99 } : {}}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm font-semibold shadow transition-all",
                    sending || cooldown ? "bg-neutral-400 cursor-not-allowed" : "bg-gradient-to-r from-brand to-brand-dark hover:shadow-md"
                  )}
                >
                  {sending
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Invio…</>
                    : <><Send className="w-4 h-4" />Invia scheda</>}
                </motion.button>
              )}
            </div>

          </div>
        </motion.div>
        </>)}
      </main>

      {/* Footer */}
      <ServiziStudio className="no-print" />

      <footer className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white/70 backdrop-blur rounded-2xl ring-1 ring-neutral-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-neutral-600 text-center sm:text-left">
              <Building2 className="w-4 h-4 text-brand" />
              <span>© {new Date().getFullYear()} <span className="font-semibold text-neutral-800">Studio CAI</span> — Tutti i diritti riservati</span>
            </div>
            <div className="text-center sm:text-right text-xs text-neutral-500 tabular-nums">
              <span className="font-mono font-semibold text-neutral-700">v{APP_VERSION}</span>
              <span className="mx-2">·</span>
              Ultimo aggiornamento: <span className="font-semibold text-neutral-700">{BUILD_DATE_LABEL}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function ConfermaInvio({ sent, onNuova, cooldown }) {
  const f = sent.dati;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}
      className="space-y-5" role="status" aria-live="polite"
    >
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-dark to-brand-deep shadow-lift px-6 sm:px-10 pt-12 pb-10 text-center">
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "32px 32px", backgroundPosition: "0 0, 16px 16px" }}
        />
        <div aria-hidden="true" className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-black/20 blur-3xl" />

        <div className="relative mx-auto w-24 h-24">
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-white/25"
            initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.6, repeat: 2, ease: "easeOut", delay: 0.4 }}
          />
          <motion.div
            initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.15 }}
            className="relative w-24 h-24 rounded-full bg-white shadow-xl ring-8 ring-white/15 flex items-center justify-center"
          >
            <svg viewBox="0 0 52 52" className="w-12 h-12" aria-hidden="true">
              <motion.path
                d="M14 27 L23 36 L39 18" fill="none" stroke={PRIMARY} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
              />
            </svg>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4 }} className="relative">
          <h2 className="font-display font-semibold text-3xl sm:text-4xl text-white mt-7 leading-tight">Grazie, invio completato</h2>
          <p className="text-white/85 text-[15px] mt-3 max-w-md mx-auto leading-relaxed">
            La tua scheda è arrivata allo studio e i dati saranno registrati nell'anagrafe del condominio.
          </p>
          <span className="inline-flex items-center gap-2 mt-5 px-4 py-1.5 rounded-full bg-white/12 ring-1 ring-white/25 text-white/90 text-xs font-medium">
            <Calendar className="w-3.5 h-3.5" />Inviata il {sent.quando}
          </span>
        </motion.div>
      </div>

      {/* Riepilogo */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.4 }}
        className="bg-white rounded-3xl shadow-lift ring-1 ring-neutral-200/80 p-5 sm:p-8"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1 bg-neutral-200" />
          <p className="font-display text-lg font-semibold text-neutral-800">Riepilogo dei dati inviati</p>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <RiepilogoDati f={f} />

        <p className="text-sm text-neutral-500 text-center mt-6 leading-relaxed">
          Ricorda: ogni variazione (vendita, affitto, nuovi recapiti) va comunicata entro 60 giorni compilando una nuova scheda.
        </p>

        <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-5">
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-brand to-brand-dark text-white text-sm font-semibold shadow hover:shadow-md transition-all"
          >
            <Printer className="w-4 h-4" />Stampa o salva il riepilogo
          </button>
          <button
            onClick={onNuova}
            disabled={cooldown > 0}
            className={cn(
              "flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border-2 text-sm font-semibold transition-all",
              cooldown > 0
                ? "border-neutral-200 text-neutral-400 cursor-not-allowed"
                : "border-brand/30 text-brand hover:border-brand/60 hover:bg-brand/5"
            )}
          >
            <RotateCcw className="w-4 h-4" />
            {cooldown > 0 ? `Nuova scheda (${cooldown}s)` : "Compila una nuova scheda"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RiepilogoDati({ f }) {
  const dest = (u) => (u.destinazione === "Altro" ? u.destinazioneAltro : u.destinazione);
  const dataIt = (d) => (d ? new Date(d).toLocaleDateString("it-IT") : "");
  const joinNz = (arr, sep = ", ") => arr.filter(Boolean).join(sep);
  const modalita = MODALITA.find((m) => m.key === f.modalita)?.label;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <RecapCard title="Condominio" icon={Building2} full>
        <p className="text-[15px] font-semibold text-neutral-900">{f.condominio}</p>
      </RecapCard>

      <RecapCard title={f.unita.length > 1 ? `Unità immobiliari (${f.unita.length})` : "Unità immobiliare"} icon={Home} full>
        <div className={cn("grid gap-3", f.unita.length > 1 && "sm:grid-cols-2")}>
          {f.unita.map((u, i) => {
            const pos = joinNz([u.palazzina && `Pal. ${u.palazzina}`, u.scala && `Sc. ${u.scala}`, u.piano && `Piano ${u.piano}`, u.interno && `Int. ${u.interno}`], " · ");
            const cat = joinNz([u.zona && `Z. ${u.zona}`, u.foglio && `Fg. ${u.foglio}`, u.particella && `Part. ${u.particella}`, u.sub && `Sub ${u.sub}`, u.categoria && `Cat. ${u.categoria}`, u.classe && `Cl. ${u.classe}`], " · ");
            return (
              <div key={i} className="rounded-2xl bg-white ring-1 ring-neutral-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-brand uppercase tracking-wider">{i + 1}ª unità</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-semibold">{dest(u)}</span>
                </div>
                {pos && <p className="text-sm text-neutral-800 font-medium mt-1.5">{pos}</p>}
                {cat && <p className="text-xs text-neutral-500 mt-1">Catasto: {cat}</p>}
              </div>
            );
          })}
        </div>
      </RecapCard>

      <RecapCard title="Dati anagrafici" icon={User}>
        <Voce label="Nome e cognome" value={f.nome} strong />
        <Voce label="Nascita" value={joinNz([f.luogoNascita, dataIt(f.dataNascita)], ", ")} />
        <Voce label="Codice fiscale" value={f.codiceFiscale} mono />
        <Voce label="Residenza" value={joinNz([f.indirizzoResidenza, f.comuneResidenza])} />
        <Voce label="Domicilio" value={joinNz([f.indirizzoDomicilio, f.comuneDomicilio])} />
        <Voce label="In qualità di" value={f.qualitaPF + (f.percentuale ? ` (${f.percentuale}%)` : f.altroDiritto ? ` – ${f.altroDiritto}` : "")} />
      </RecapCard>

      <RecapCard title="Recapiti" icon={Phone}>
        <Voce label="Titolare" value={f.nomeRecapiti} strong />
        <Voce label="Telefono" value={joinNz([f.tel1, f.tel2, f.tel3])} />
        <Voce label="E-mail" value={joinNz([f.email1, f.email2, f.email3])} />
        <Voce label="PEC" value={joinNz([f.pec1, f.pec2])} />
        <Voce label="Altro" value={f.altroRecapito} />
      </RecapCard>

      <RecapCard title="Corrispondenza" icon={Mail} full>
        <Voce label="Modalità" value={modalita} strong />
        {f.modalita === "racc_altro" && (
          <Voce label="Indirizzo" value={joinNz([f.indirizzoRacc, joinNz([f.capRacc, f.cittaRacc, f.provRacc && `(${f.provRacc})`], " ")])} />
        )}
        {f.modalita === "pec" && <Voce label="Indirizzo PEC" value={f.pec1} />}
      </RecapCard>
    </div>
  );
}

function RecapCard({ title, icon: Icon, full, children }) {
  return (
    <div className={cn("rounded-2xl bg-gradient-to-br from-neutral-50 to-white ring-1 ring-neutral-200 p-4 sm:p-5", full && "sm:col-span-2")}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </span>
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{title}</p>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Voce({ label, value, strong, mono }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">{label}</p>
      <p className={cn(
        "text-sm text-neutral-800 break-words",
        strong && "font-semibold text-neutral-900",
        mono && "font-mono tracking-tight"
      )}>{value}</p>
    </div>
  );
}

function TF({ label, value, onChange, placeholder, type = "text", icon, required, error, hint }) {
  return (
    <div>
      <label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5 mb-1.5">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-2xl border py-3 text-sm focus:outline-none focus:ring-2 transition-all bg-white placeholder:text-neutral-400",
            icon ? "pl-10 pr-4" : "px-4",
            error
              ? "border-red-300 focus:ring-red-500/20 focus:border-red-500"
              : "border-neutral-300 hover:border-neutral-400 focus:ring-brand/20 focus:border-brand"
          )}
        />
      </div>
      {error ? (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{error}
        </motion.p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

function SF({ label, value, onChange, options = [], required, error }) {
  return (
    <div>
      <label className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5 mb-1.5">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "appearance-none w-full rounded-2xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 bg-white transition-all",
            error
              ? "border-red-300 focus:ring-red-500/20 focus:border-red-500"
              : "border-neutral-300 hover:border-neutral-400 focus:ring-brand/20 focus:border-brand"
          )}
        >
          <option value="">— Seleziona —</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
      </div>
      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{error}
        </motion.p>
      )}
    </div>
  );
}

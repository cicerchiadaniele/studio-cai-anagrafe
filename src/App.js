import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  Loader2,
  ChevronDown,
  Plus,
  Trash2,
  Paperclip,
  FileText,
} from "lucide-react";

// Helpers
const cn = (...cls) => cls.filter(Boolean).join(" ");
const load = (k, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || "");
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

const uid = () => Math.random().toString(36).slice(2, 10);

const DESTINAZIONI = [
  "Abitazione",
  "Negozio",
  "Ufficio",
  "Autorimessa",
  "Posto auto",
  "Cantina",
  "Altro",
];

const QUALITA = [
  "Unico Proprietario",
  "Comproprietario",
  "Usufruttuario",
  "Nudo proprietario",
  "Titolare di altro diritto reale",
];

export default function AnagrafeCondominiale() {
  // Brand / theme / endpoint (coerenti con la webapp segnalazioni)
  const [brandName] = useState(load("ac_brand", "Studio CAI"));
  const [logoUrl] = useState(load("ac_logo", "/logo.jpg"));
  const [primary] = useState(load("ac_primary", "#16a34a"));
  const [webhook] = useState(
    load("ac_webhook", "https://hook.eu1.make.com/INSERISCI_LA_TUA_WEBHOOK")
  );

  // Form state
  const [form, setForm] = useState({
    // Condominio (utile anche per collegare la scheda al fabbricato)
    condominio: "",
    indirizzoCondominio: "",

    // Unità immobiliari (ripetibili)
    unita: [
      {
        id: uid(),
        palazzina: "",
        scala: "",
        piano: "",
        interno: "",
        catZona: "",
        catFoglio: "",
        catParticella: "",
        catSub: "",
        catClasse: "",
        catCategoria: "",
        destinazione: "",
        destinazioneAltro: "",
      },
    ],

    // Dichiarante
    dichiaranteTipo: "personaFisica", // personaFisica | rappresentante
    dichiarante: {
      nome: "",
      luogoNascita: "",
      dataNascita: "",
      comuneResidenza: "",
      indirizzoResidenza: "",
      codiceFiscale: "",
      comuneDomicilio: "",
      indirizzoDomicilio: "",
      qualita: "", // una delle QUALITA
      comproprietarioPerc: "",
      altroDiritto: "",
    },
    rappresentanza: {
      qualifica: "", // Legale rappresentante | Tutore del minore | Altro
      qualificaAltro: "",
      soggetto: {
        denominazioneONome: "",
        luogoNascita: "",
        dataNascita: "",
        comuneSedeRes: "",
        indirizzoSedeRes: "",
        pivaOCF: "",
      },
    },

    // Ulteriori titolari (ripetibili)
    ulterioriTitolari: [],

    // Locazione / comodato (se presente)
    locazionePresente: false,
    locazione: {
      denominazioneONome: "",
      luogoNascita: "",
      dataNascita: "",
      comuneSedeRes: "",
      indirizzoSedeRes: "",
      pivaOCF: "",
    },

    // Recapiti utili (facoltativi)
    recapiti: {
      intestatario: "",
      telefono1: "",
      telefono2: "",
      telefono3: "",
      email1: "",
      email2: "",
      email3: "",
      pec1: "",
      pec2: "",
      altro: "",
    },

    // Preferenze invio
    invio: {
      raccomandataAR: false,
      raccomandataIndirizzo: "",
      raccomandataCap: "",
      raccomandataCitta: "",
      raccomandataProv: "",
      pec: false,
    },

    // Autorizzazione invio email ordinaria
    emailOrdinariaAutorizzata: false,
    emailOrdinaria: {
      email: "",
      viaImmobile: "",
      palazzina: "",
      scala: "",
      piano: "",
      interno: "",
      qualita: "",
      comproprietarioPerc: "",
      altroDiritto: "",
    },

    // Allegati
    allegati: [],

    // Consensi e chiusura
    consensoPrivacy: false,
    dataFirma: "",
    firma: "",
  });

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const cssVars = useMemo(() => ({ "--brand": primary }), [primary]);

  const update = (path, value) => {
    setForm((s) => {
      const next = structuredClone(s);
      const keys = path.split(".");
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const addUnita = () =>
    setForm((s) => ({
      ...s,
      unita: [
        ...s.unita,
        {
          id: uid(),
          palazzina: "",
          scala: "",
          piano: "",
          interno: "",
          catZona: "",
          catFoglio: "",
          catParticella: "",
          catSub: "",
          catClasse: "",
          catCategoria: "",
          destinazione: "",
          destinazioneAltro: "",
        },
      ],
    }));

  const removeUnita = (id) =>
    setForm((s) => ({
      ...s,
      unita: s.unita.length <= 1 ? s.unita : s.unita.filter((u) => u.id !== id),
    }));

  const addTitolare = () =>
    setForm((s) => ({
      ...s,
      ulterioriTitolari: [
        ...s.ulterioriTitolari,
        {
          id: uid(),
          denominazioneONome: "",
          luogoNascita: "",
          dataNascita: "",
          comuneSedeRes: "",
          indirizzoSedeRes: "",
          pivaOCF: "",
          comuneDomicilio: "",
          indirizzoDomicilio: "",
          qualita: "",
          comproprietarioPerc: "",
          altroDiritto: "",
        },
      ],
    }));

  const removeTitolare = (id) =>
    setForm((s) => ({
      ...s,
      ulterioriTitolari: s.ulterioriTitolari.filter((t) => t.id !== id),
    }));

  const validate = () => {
    const errs = [];
    if (!form.condominio.trim()) errs.push("Indica il Condominio (riferimento)");
    if (!form.unita.length) errs.push("Inserisci almeno una unità immobiliare");

    // Controllo minimo sulle unità: almeno scala/piano/interno o dati catastali (per collegamento certo)
    form.unita.forEach((u, idx) => {
      const label = `Unità ${idx + 1}`;
      const hasId = (u.scala || u.piano || u.interno || u.palazzina).trim?.() || (u.catFoglio || u.catParticella || u.catSub).trim?.();
      if (!hasId) errs.push(`${label}: indica almeno Palazzina/Scala/Piano/Interno oppure Foglio/Particella/Sub`);
      if (u.destinazione === "Altro" && !u.destinazioneAltro.trim()) errs.push(`${label}: specifica "Altro" nella destinazione`);
    });

    if (!form.dichiarante.nome.trim()) errs.push("Dichiarante: inserisci Nome e Cognome");
    if (!form.dichiarante.codiceFiscale.trim()) errs.push("Dichiarante: inserisci Codice Fiscale");
    if (!form.dichiarante.qualita) errs.push("Dichiarante: seleziona la qualifica (proprietà / diritto reale)");
    if (form.dichiarante.qualita === "Comproprietario" && !form.dichiarante.comproprietarioPerc.trim())
      errs.push("Dichiarante: indica la percentuale di comproprietà");
    if (form.dichiarante.qualita === "Titolare di altro diritto reale" && !form.dichiarante.altroDiritto.trim())
      errs.push("Dichiarante: specifica l'altro diritto reale");

    if (form.dichiaranteTipo === "rappresentante") {
      if (!form.rappresentanza.qualifica) errs.push("Rappresentanza: seleziona la qualifica (legale rappresentante / tutore / altro)");
      if (form.rappresentanza.qualifica === "Altro" && !form.rappresentanza.qualificaAltro.trim())
        errs.push("Rappresentanza: specifica la qualifica 'Altro'");
      if (!form.rappresentanza.soggetto.denominazioneONome.trim())
        errs.push("Rappresentanza: indica Denominazione o Nome e Cognome del soggetto rappresentato");
      if (!form.rappresentanza.soggetto.pivaOCF.trim()) errs.push("Rappresentanza: indica P.IVA o Codice Fiscale del soggetto rappresentato");
    }

    // Ulteriori titolari: se compilati parzialmente, richiedi i minimi
    form.ulterioriTitolari.forEach((t, idx) => {
      const any = Object.values(t).some((v) => typeof v === "string" && v.trim());
      if (!any) return;
      const label = `Ulteriore titolare ${idx + 1}`;
      if (!t.denominazioneONome.trim()) errs.push(`${label}: indica Denominazione o Nome e Cognome`);
      if (!t.pivaOCF.trim()) errs.push(`${label}: indica P.IVA o Codice Fiscale`);
      if (!t.qualita) errs.push(`${label}: seleziona la qualifica (proprietà / diritto reale)`);
      if (t.qualita === "Comproprietario" && !t.comproprietarioPerc.trim()) errs.push(`${label}: indica la percentuale di comproprietà`);
      if (t.qualita === "Titolare di altro diritto reale" && !t.altroDiritto.trim()) errs.push(`${label}: specifica l'altro diritto reale`);
    });

    if (form.locazionePresente) {
      if (!form.locazione.denominazioneONome.trim()) errs.push("Locazione/Comodato: indica Denominazione o Nome e Cognome");
    }

    // Autorizzazione email ordinaria
    if (form.emailOrdinariaAutorizzata) {
      if (!form.emailOrdinaria.email.trim()) errs.push("Email ordinaria: indica l'indirizzo email");
      if (!form.emailOrdinaria.qualita) errs.push("Email ordinaria: seleziona la qualifica (proprietà / diritto reale)");
      if (form.emailOrdinaria.qualita === "Comproprietario" && !form.emailOrdinaria.comproprietarioPerc.trim())
        errs.push("Email ordinaria: indica la percentuale di comproprietà");
      if (form.emailOrdinaria.qualita === "Titolare di altro diritto reale" && !form.emailOrdinaria.altroDiritto.trim())
        errs.push("Email ordinaria: specifica l'altro diritto reale");
    }

    if (!form.consensoPrivacy) errs.push("Accetta l'informativa privacy");

    // Firma
    if (!form.firma.trim()) errs.push("Inserisci il nominativo in firma");
    return errs;
  };

  const submit = async () => {
    if (cooldown) return;

    const errs = validate();
    if (errs.length) {
      setResult({ ok: false, error: errs.join(" • ") });
      return;
    }

    setSending(true);
    setResult(null);

    const ticket = `ANAG-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    try {
      const fd = new FormData();

      // Campi semplici
      fd.append("ticket", ticket);
      fd.append("timestamp", new Date().toISOString());
      fd.append("condominio", form.condominio);
      fd.append("indirizzoCondominio", form.indirizzoCondominio);

      // Sezioni complesse in JSON (più robuste per Make.com / Zapier / backend)
      fd.append("unita_json", JSON.stringify(form.unita));
      fd.append("dichiaranteTipo", form.dichiaranteTipo);
      fd.append("dichiarante_json", JSON.stringify(form.dichiarante));
      fd.append("rappresentanza_json", JSON.stringify(form.rappresentanza));
      fd.append("ulterioriTitolari_json", JSON.stringify(form.ulterioriTitolari));
      fd.append("locazionePresente", String(form.locazionePresente));
      fd.append("locazione_json", JSON.stringify(form.locazione));
      fd.append("recapiti_json", JSON.stringify(form.recapiti));
      fd.append("invio_json", JSON.stringify(form.invio));
      fd.append("emailOrdinariaAutorizzata", String(form.emailOrdinariaAutorizzata));
      fd.append("emailOrdinaria_json", JSON.stringify(form.emailOrdinaria));
      fd.append("consensoPrivacy", String(form.consensoPrivacy));
      fd.append("dataFirma", form.dataFirma);
      fd.append("firma", form.firma);

      // Allegati (multipli)
      (form.allegati || []).forEach((f, idx) => {
        fd.append(`file${idx + 1}`, f, f.name);
      });

      const res = await fetch(webhook, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Errore invio: ${res.status}`);

      setResult({ ok: true, ticket });
      setCooldown(10);

      // Reset leggero (mantengo condominio e consenso se utile)
      setForm((s) => ({
        ...s,
        unita: [
          {
            id: uid(),
            palazzina: "",
            scala: "",
            piano: "",
            interno: "",
            catZona: "",
            catFoglio: "",
            catParticella: "",
            catSub: "",
            catClasse: "",
            catCategoria: "",
            destinazione: "",
            destinazioneAltro: "",
          },
        ],
        dichiaranteTipo: "personaFisica",
        dichiarante: {
          nome: "",
          luogoNascita: "",
          dataNascita: "",
          comuneResidenza: "",
          indirizzoResidenza: "",
          codiceFiscale: "",
          comuneDomicilio: "",
          indirizzoDomicilio: "",
          qualita: "",
          comproprietarioPerc: "",
          altroDiritto: "",
        },
        rappresentanza: {
          qualifica: "",
          qualificaAltro: "",
          soggetto: {
            denominazioneONome: "",
            luogoNascita: "",
            dataNascita: "",
            comuneSedeRes: "",
            indirizzoSedeRes: "",
            pivaOCF: "",
          },
        },
        ulterioriTitolari: [],
        locazionePresente: false,
        locazione: {
          denominazioneONome: "",
          luogoNascita: "",
          dataNascita: "",
          comuneSedeRes: "",
          indirizzoSedeRes: "",
          pivaOCF: "",
        },
        recapiti: {
          intestatario: "",
          telefono1: "",
          telefono2: "",
          telefono3: "",
          email1: "",
          email2: "",
          email3: "",
          pec1: "",
          pec2: "",
          altro: "",
        },
        invio: {
          raccomandataAR: false,
          raccomandataIndirizzo: "",
          raccomandataCap: "",
          raccomandataCitta: "",
          raccomandataProv: "",
          pec: false,
        },
        emailOrdinariaAutorizzata: false,
        emailOrdinaria: {
          email: "",
          viaImmobile: "",
          palazzina: "",
          scala: "",
          piano: "",
          interno: "",
          qualita: "",
          comproprietarioPerc: "",
          altroDiritto: "",
        },
        allegati: [],
        dataFirma: "",
        firma: "",
      }));
    } catch (e) {
      setResult({ ok: false, error: e.message || "Invio non riuscito" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900" style={cssVars}>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[var(--brand)]/10 flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <Building2 className="w-8 h-8" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-semibold leading-5 text-lg">{brandName}</div>
            <div className="text-xs text-neutral-500">Modulo digitale – Registro Anagrafe Condominiale</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <motion.div layout className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-lg">Raccolta informazioni – Anagrafe condominiale</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label="Condominio (riferimento)"
              placeholder="Es. Via Don Rua 39 – Roma"
              value={form.condominio}
              onChange={(v) => update("condominio", v)}
              required
            />
            <TextField
              label="Indirizzo unità / note (facoltativo)"
              placeholder="Es. Via/Piazza…, civico…"
              value={form.indirizzoCondominio}
              onChange={(v) => update("indirizzoCondominio", v)}
            />
          </div>

          <Divider />

          <SectionTitle icon={<FileText className="w-4 h-4" />} title="Unità immobiliari" subtitle="Inserire i dati identificativi dell’unità (ripetibile)." />

          <div className="space-y-4">
            {form.unita.map((u, idx) => (
              <div key={u.id} className="rounded-2xl border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">Unità {idx + 1}</div>
                  <button
                    type="button"
                    onClick={() => removeUnita(u.id)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm",
                      form.unita.length <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-neutral-50"
                    )}
                    disabled={form.unita.length <= 1}
                    title="Rimuovi unità"
                  >
                    <Trash2 className="w-4 h-4" /> Rimuovi
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <TextField label="Palazzina" value={u.palazzina} onChange={(v) => setUnita(u.id, "palazzina", v)} placeholder="Es. A / B2" />
                  <div className="grid grid-cols-3 gap-3">
                    <TextField label="Scala" value={u.scala} onChange={(v) => setUnita(u.id, "scala", v)} placeholder="Es. A" />
                    <TextField label="Piano" value={u.piano} onChange={(v) => setUnita(u.id, "piano", v)} placeholder="Es. 1" />
                    <TextField label="Interno" value={u.interno} onChange={(v) => setUnita(u.id, "interno", v)} placeholder="Es. 12" />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-3">
                  <TextField label="Zona" value={u.catZona} onChange={(v) => setUnita(u.id, "catZona", v)} />
                  <TextField label="Foglio" value={u.catFoglio} onChange={(v) => setUnita(u.id, "catFoglio", v)} />
                  <TextField label="Particella" value={u.catParticella} onChange={(v) => setUnita(u.id, "catParticella", v)} />
                  <TextField label="Sub" value={u.catSub} onChange={(v) => setUnita(u.id, "catSub", v)} />
                  <TextField label="Classe" value={u.catClasse} onChange={(v) => setUnita(u.id, "catClasse", v)} />
                  <TextField label="Categoria" value={u.catCategoria} onChange={(v) => setUnita(u.id, "catCategoria", v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <SelectField
                    label="Destinazione"
                    value={u.destinazione}
                    onChange={(v) => setUnita(u.id, "destinazione", v)}
                    options={DESTINAZIONI}
                  />
                  {u.destinazione === "Altro" && (
                    <TextField
                      label="Destinazione – Altro"
                      value={u.destinazioneAltro}
                      onChange={(v) => setUnita(u.id, "destinazioneAltro", v)}
                      placeholder="Specificare"
                      required
                    />
                  )}
                </div>
              </div>
            ))}

            <button type="button" onClick={addUnita} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand)] text-white hover:opacity-90">
              <Plus className="w-4 h-4" /> Aggiungi unità
            </button>
          </div>

          <Divider />

          <SectionTitle icon={<Shield className="w-4 h-4" />} title="Dichiarante" subtitle="Dati del soggetto che compila e sottoscrive la scheda." />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectField
              label="Tipologia dichiarante"
              value={form.dichiaranteTipo}
              onChange={(v) => update("dichiaranteTipo", v)}
              options={[
                { value: "personaFisica", label: "Persona fisica" },
                { value: "rappresentante", label: "Legale rappresentante / tutore / altro" },
              ]}
              required
            />
            <SelectField
              label="In qualità di"
              value={form.dichiarante.qualita}
              onChange={(v) => update("dichiarante.qualita", v)}
              options={QUALITA}
              required
            />
          </div>

          {form.dichiarante.qualita === "Comproprietario" && (
            <div className="mt-3">
              <TextField
                label="Percentuale comproprietà"
                value={form.dichiarante.comproprietarioPerc}
                onChange={(v) => update("dichiarante.comproprietarioPerc", v)}
                placeholder="Es. 50"
                required
              />
            </div>
          )}

          {form.dichiarante.qualita === "Titolare di altro diritto reale" && (
            <div className="mt-3">
              <TextField
                label="Altro diritto reale"
                value={form.dichiarante.altroDiritto}
                onChange={(v) => update("dichiarante.altroDiritto", v)}
                placeholder="Specificare"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <TextField label="Nome e Cognome" value={form.dichiarante.nome} onChange={(v) => update("dichiarante.nome", v)} required />
            <TextField label="Codice Fiscale" value={form.dichiarante.codiceFiscale} onChange={(v) => update("dichiarante.codiceFiscale", v)} required />
            <TextField label="Luogo di nascita" value={form.dichiarante.luogoNascita} onChange={(v) => update("dichiarante.luogoNascita", v)} />
            <TextField label="Data di nascita" type="date" value={form.dichiarante.dataNascita} onChange={(v) => update("dichiarante.dataNascita", v)} />
            <TextField label="Comune di residenza" value={form.dichiarante.comuneResidenza} onChange={(v) => update("dichiarante.comuneResidenza", v)} />
            <TextField label="Indirizzo di residenza" value={form.dichiarante.indirizzoResidenza} onChange={(v) => update("dichiarante.indirizzoResidenza", v)} />
            <TextField label="Comune di domicilio (se diverso)" value={form.dichiarante.comuneDomicilio} onChange={(v) => update("dichiarante.comuneDomicilio", v)} />
            <TextField
              label="Indirizzo domicilio (se diverso)"
              value={form.dichiarante.indirizzoDomicilio}
              onChange={(v) => update("dichiarante.indirizzoDomicilio", v)}
            />
          </div>

          {form.dichiaranteTipo === "rappresentante" && (
            <div className="mt-4 rounded-2xl border p-3 bg-neutral-50">
              <div className="font-medium mb-2">Dati rappresentanza</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SelectField
                  label="Qualifica"
                  value={form.rappresentanza.qualifica}
                  onChange={(v) => update("rappresentanza.qualifica", v)}
                  options={[
                    "Legale rappresentante della Società",
                    "Tutore del minore",
                    "Altro",
                  ]}
                  required
                />
                {form.rappresentanza.qualifica === "Altro" && (
                  <TextField
                    label="Qualifica – Altro"
                    value={form.rappresentanza.qualificaAltro}
                    onChange={(v) => update("rappresentanza.qualificaAltro", v)}
                    placeholder="Specificare"
                    required
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <TextField
                  label="Denominazione o Nome e Cognome (rappresentato)"
                  value={form.rappresentanza.soggetto.denominazioneONome}
                  onChange={(v) => update("rappresentanza.soggetto.denominazioneONome", v)}
                  required
                />
                <TextField
                  label="P.IVA o Codice Fiscale (rappresentato)"
                  value={form.rappresentanza.soggetto.pivaOCF}
                  onChange={(v) => update("rappresentanza.soggetto.pivaOCF", v)}
                  required
                />
                <TextField
                  label="Luogo di nascita"
                  value={form.rappresentanza.soggetto.luogoNascita}
                  onChange={(v) => update("rappresentanza.soggetto.luogoNascita", v)}
                />
                <TextField
                  label="Data di nascita"
                  type="date"
                  value={form.rappresentanza.soggetto.dataNascita}
                  onChange={(v) => update("rappresentanza.soggetto.dataNascita", v)}
                />
                <TextField
                  label="Comune sede/residenza"
                  value={form.rappresentanza.soggetto.comuneSedeRes}
                  onChange={(v) => update("rappresentanza.soggetto.comuneSedeRes", v)}
                />
                <TextField
                  label="Indirizzo sede/residenza"
                  value={form.rappresentanza.soggetto.indirizzoSedeRes}
                  onChange={(v) => update("rappresentanza.soggetto.indirizzoSedeRes", v)}
                />
              </div>
            </div>
          )}

          <Divider />

          <SectionTitle icon={<Plus className="w-4 h-4" />} title="Ulteriori titolari di diritti reali / detrazioni fiscali" subtitle="Se presenti, inserire i dati dei soggetti ulteriori (ripetibile)." />

          <div className="space-y-3">
            {form.ulterioriTitolari.length === 0 && (
              <div className="text-sm text-neutral-600">Nessun ulteriore titolare inserito.</div>
            )}

            {form.ulterioriTitolari.map((t, idx) => (
              <div key={t.id} className="rounded-2xl border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">Ulteriore titolare {idx + 1}</div>
                  <button type="button" onClick={() => removeTitolare(t.id)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm hover:bg-neutral-50">
                    <Trash2 className="w-4 h-4" /> Rimuovi
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <TextField label="Denominazione o Nome e Cognome" value={t.denominazioneONome} onChange={(v) => setTitolare(t.id, "denominazioneONome", v)} />
                  <TextField label="P.IVA o Codice Fiscale" value={t.pivaOCF} onChange={(v) => setTitolare(t.id, "pivaOCF", v)} />
                  <TextField label="Luogo di nascita" value={t.luogoNascita} onChange={(v) => setTitolare(t.id, "luogoNascita", v)} />
                  <TextField label="Data di nascita" type="date" value={t.dataNascita} onChange={(v) => setTitolare(t.id, "dataNascita", v)} />
                  <TextField label="Comune sede/residenza" value={t.comuneSedeRes} onChange={(v) => setTitolare(t.id, "comuneSedeRes", v)} />
                  <TextField label="Indirizzo sede/residenza" value={t.indirizzoSedeRes} onChange={(v) => setTitolare(t.id, "indirizzoSedeRes", v)} />
                  <TextField label="Comune domicilio (se diverso)" value={t.comuneDomicilio} onChange={(v) => setTitolare(t.id, "comuneDomicilio", v)} />
                  <TextField label="Indirizzo domicilio (se diverso)" value={t.indirizzoDomicilio} onChange={(v) => setTitolare(t.id, "indirizzoDomicilio", v)} />
                  <SelectField label="In qualità di" value={t.qualita} onChange={(v) => setTitolare(t.id, "qualita", v)} options={QUALITA} />
                  {t.qualita === "Comproprietario" && (
                    <TextField label="Percentuale comproprietà" value={t.comproprietarioPerc} onChange={(v) => setTitolare(t.id, "comproprietarioPerc", v)} placeholder="Es. 50" />
                  )}
                  {t.qualita === "Titolare di altro diritto reale" && (
                    <TextField label="Altro diritto reale" value={t.altroDiritto} onChange={(v) => setTitolare(t.id, "altroDiritto", v)} placeholder="Specificare" />
                  )}
                </div>
              </div>
            ))}

            <button type="button" onClick={addTitolare} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand)] text-white hover:opacity-90">
              <Plus className="w-4 h-4" /> Aggiungi titolare
            </button>
          </div>

          <Divider />

          <SectionTitle icon={<FileText className="w-4 h-4" />} title="Locazione / comodato" subtitle="Compilare solo se l’unità risulta locata o concessa in comodato." />

          <div className="flex items-start gap-2">
            <input
              id="loc"
              type="checkbox"
              checked={form.locazionePresente}
              onChange={(e) => update("locazionePresente", e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="loc" className="text-sm text-neutral-700">
              Sì, è presente una locazione o un comodato
            </label>
          </div>

          {form.locazionePresente && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField label="Denominazione o Nome e Cognome" value={form.locazione.denominazioneONome} onChange={(v) => update("locazione.denominazioneONome", v)} required />
              <TextField label="P.IVA o Codice Fiscale" value={form.locazione.pivaOCF} onChange={(v) => update("locazione.pivaOCF", v)} />
              <TextField label="Luogo di nascita" value={form.locazione.luogoNascita} onChange={(v) => update("locazione.luogoNascita", v)} />
              <TextField label="Data di nascita" type="date" value={form.locazione.dataNascita} onChange={(v) => update("locazione.dataNascita", v)} />
              <TextField label="Comune sede/residenza" value={form.locazione.comuneSedeRes} onChange={(v) => update("locazione.comuneSedeRes", v)} />
              <TextField label="Indirizzo sede/residenza" value={form.locazione.indirizzoSedeRes} onChange={(v) => update("locazione.indirizzoSedeRes", v)} />
            </div>
          )}

          <Divider />

          <SectionTitle icon={<Shield className="w-4 h-4" />} title="Recapiti utili" subtitle="Dati facoltativi per agevolare le comunicazioni (telefono, email, PEC)." />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField label="Nome e cognome intestatario recapiti" value={form.recapiti.intestatario} onChange={(v) => update("recapiti.intestatario", v)} />
            <TextField label="Altro (facoltativo)" value={form.recapiti.altro} onChange={(v) => update("recapiti.altro", v)} />
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <TextField label="Telefono 1" value={form.recapiti.telefono1} onChange={(v) => update("recapiti.telefono1", v)} />
            <TextField label="Telefono 2" value={form.recapiti.telefono2} onChange={(v) => update("recapiti.telefono2", v)} />
            <TextField label="Telefono 3" value={form.recapiti.telefono3} onChange={(v) => update("recapiti.telefono3", v)} />
            <TextField label="Email 1" value={form.recapiti.email1} onChange={(v) => update("recapiti.email1", v)} />
            <TextField label="Email 2" value={form.recapiti.email2} onChange={(v) => update("recapiti.email2", v)} />
            <TextField label="Email 3" value={form.recapiti.email3} onChange={(v) => update("recapiti.email3", v)} />
            <TextField label="PEC 1" value={form.recapiti.pec1} onChange={(v) => update("recapiti.pec1", v)} />
            <TextField label="PEC 2" value={form.recapiti.pec2} onChange={(v) => update("recapiti.pec2", v)} />
          </div>

          <Divider />

          <SectionTitle icon={<FileText className="w-4 h-4" />} title="Preferenze modalità di invio" subtitle="Indicare la modalità preferita per le comunicazioni (se desiderato)." />

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <input
                id="rac"
                type="checkbox"
                checked={form.invio.raccomandataAR}
                onChange={(e) => update("invio.raccomandataAR", e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="rac" className="text-sm text-neutral-700">
                Tutta la corrispondenza via raccomandata A/R
              </label>
            </div>

            {form.invio.raccomandataAR && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TextField label="Indirizzo" value={form.invio.raccomandataIndirizzo} onChange={(v) => update("invio.raccomandataIndirizzo", v)} />
                <div className="grid grid-cols-3 gap-3">
                  <TextField label="CAP" value={form.invio.raccomandataCap} onChange={(v) => update("invio.raccomandataCap", v)} />
                  <TextField label="Città" value={form.invio.raccomandataCitta} onChange={(v) => update("invio.raccomandataCitta", v)} />
                  <TextField label="Prov." value={form.invio.raccomandataProv} onChange={(v) => update("invio.raccomandataProv", v)} placeholder="Es. RM" />
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <input id="pec" type="checkbox" checked={form.invio.pec} onChange={(e) => update("invio.pec", e.target.checked)} className="mt-1" />
              <label htmlFor="pec" className="text-sm text-neutral-700">
                Comunicazioni tramite PEC (con valore di raccomandata)
              </label>
            </div>
          </div>

          <Divider />

          <SectionTitle icon={<FileText className="w-4 h-4" />} title="Autorizzazione invio via email ordinaria" subtitle="Facoltativa: consente invio convocazioni/verbali e comunicazioni via email ordinaria (senza valore legale)." />

          <div className="flex items-start gap-2">
            <input
              id="mailord"
              type="checkbox"
              checked={form.emailOrdinariaAutorizzata}
              onChange={(e) => update("emailOrdinariaAutorizzata", e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="mailord" className="text-sm text-neutral-700">
              Autorizzo l’invio tramite posta elettronica ordinaria
            </label>
          </div>

          {form.emailOrdinariaAutorizzata && (
            <div className="mt-3 rounded-2xl border p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TextField label="Email ordinaria" value={form.emailOrdinaria.email} onChange={(v) => update("emailOrdinaria.email", v)} required />
                <SelectField
                  label="In qualità di"
                  value={form.emailOrdinaria.qualita}
                  onChange={(v) => update("emailOrdinaria.qualita", v)}
                  options={QUALITA}
                  required
                />
                {form.emailOrdinaria.qualita === "Comproprietario" && (
                  <TextField label="Percentuale comproprietà" value={form.emailOrdinaria.comproprietarioPerc} onChange={(v) => update("emailOrdinaria.comproprietarioPerc", v)} required />
                )}
                {form.emailOrdinaria.qualita === "Titolare di altro diritto reale" && (
                  <TextField label="Altro diritto reale" value={form.emailOrdinaria.altroDiritto} onChange={(v) => update("emailOrdinaria.altroDiritto", v)} required />
                )}
                <TextField label="Via immobile" value={form.emailOrdinaria.viaImmobile} onChange={(v) => update("emailOrdinaria.viaImmobile", v)} placeholder="Es. Via …" />
                <div className="grid grid-cols-4 gap-3">
                  <TextField label="Pal." value={form.emailOrdinaria.palazzina} onChange={(v) => update("emailOrdinaria.palazzina", v)} />
                  <TextField label="Scala" value={form.emailOrdinaria.scala} onChange={(v) => update("emailOrdinaria.scala", v)} />
                  <TextField label="Piano" value={form.emailOrdinaria.piano} onChange={(v) => update("emailOrdinaria.piano", v)} />
                  <TextField label="Int." value={form.emailOrdinaria.interno} onChange={(v) => update("emailOrdinaria.interno", v)} />
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                Nota: l’email ordinaria non ha valore legale; l’autorizzazione ha finalità di riduzione costi di spedizione e fotocopie.
              </div>
            </div>
          )}

          <Divider />

          <SectionTitle icon={<Paperclip className="w-4 h-4" />} title="Allegati" subtitle="Caricare, se disponibili, copie dei documenti di identità e codici fiscali (dichiarante e altri aventi diritto)." />

          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => update("allegati", Array.from(e.target.files || []))}
            className="mt-1 block w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--brand)]/10 file:text-[var(--brand)] hover:file:bg-[var(--brand)]/20"
          />
          {(form.allegati || []).length > 0 && (
            <div className="mt-2 text-xs text-neutral-600">
              Allegati selezionati: {(form.allegati || []).map((f) => f.name).join(", ")}
            </div>
          )}

          <Divider />

          <SectionTitle icon={<Shield className="w-4 h-4" />} title="Privacy e firma" subtitle="Il conferimento dei dati richiesti dal registro anagrafe è obbligatorio; i recapiti aggiuntivi sono facoltativi." />

          <div className="mt-2 flex items-start gap-2">
            <input
              id="cons"
              type="checkbox"
              checked={form.consensoPrivacy}
              onChange={(e) => update("consensoPrivacy", e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="cons" className="text-sm text-neutral-700">
              Ho letto e accetto l’informativa privacy e autorizzo il trattamento dei dati per finalità connesse alla gestione condominiale.
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <TextField label="Data" type="date" value={form.dataFirma} onChange={(v) => update("dataFirma", v)} />
            <TextField label="Firma (digitare Nome e Cognome)" value={form.firma} onChange={(v) => update("firma", v)} required />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              disabled={sending || cooldown > 0}
              onClick={submit}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white",
                sending || cooldown ? "bg-neutral-400" : "bg-[var(--brand)] hover:opacity-90"
              )}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Invio…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Invia modulo
                </>
              )}
            </button>
            {cooldown > 0 && <span className="text-xs text-neutral-500">Puoi inviare un altro modulo tra {cooldown}s</span>}
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={cn(
                  "mt-4 rounded-xl border p-3 text-sm flex items-start gap-2",
                  result.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                )}
              >
                {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
                <div>
                  {result.ok ? (
                    <div>
                      <div className="font-medium">Modulo inviato correttamente.</div>
                      {result.ticket && (
                        <div className="text-xs text-neutral-600">
                          Numero pratica: <span className="font-mono font-semibold">{result.ticket}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium">Invio non riuscito</div>
                      <div className="text-xs text-neutral-600">{result.error}</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 pb-8 text-xs text-neutral-500">
        <div className="flex items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} {brandName}. Tutti i diritti riservati.</div>
          <div className="text-right">v1.0 – Modulo Anagrafe Condominiale</div>
        </div>
      </footer>
    </div>
  );

  function setUnita(id, key, value) {
    setForm((s) => ({
      ...s,
      unita: s.unita.map((u) => (u.id === id ? { ...u, [key]: value } : u)),
    }));
  }

  function setTitolare(id, key, value) {
    setForm((s) => ({
      ...s,
      ulterioriTitolari: s.ulterioriTitolari.map((t) => (t.id === id ? { ...t, [key]: value } : t)),
    }));
  }
}

function Divider() {
  return <div className="my-5 h-px bg-neutral-200" />;
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center">{icon}</div>
        <div className="font-semibold">{title}</div>
      </div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text", required }) {
  return (
    <div>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options = [], required }) {
  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600">*</span>}
      </label>
      <div className="mt-1 relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] bg-white"
          required={required}
        >
          <option value="">-- Seleziona --</option>
          {normalized.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" />
      </div>
    </div>
  );
}

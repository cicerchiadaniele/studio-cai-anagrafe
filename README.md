# Anagrafe condominiale — Studio CAI

Webapp pubblica con cui i condòmini compilano la scheda per il Registro di anagrafe condominiale (art. 1130 c.c., L. 220/2012). I dati vengono trasmessi allo studio tramite webhook Make.

## Percorso guidato (5 passi)

1. **Condominio e unità**: condominio (testo libero), fino a 3 unità con posizione, dati catastali facoltativi e destinazione d'uso.
2. **Dati anagrafici**: nome, nascita, residenza, domicilio, codice fiscale (con verifica del carattere di controllo), qualità del dichiarante.
3. **Recapiti**: titolare dei recapiti (precompilato con il nome del dichiarante), telefoni, e-mail, PEC.
4. **Corrispondenza**: raccomandata alla residenza, raccomandata ad altro indirizzo o PEC.
5. **Riepilogo e consenso**: riepilogo completo di tutti i dati e presa visione dell'informativa privacy.

Dopo l'invio riuscito compare la schermata di conferma con il riepilogo dei dati inviati, stampabile o salvabile in PDF.

## Comportamenti

- **Bozza sul dispositivo**: la compilazione viene salvata automaticamente sul dispositivo (localStorage, scadenza 7 giorni, consenso escluso). Alla riapertura si può riprendere o ricominciare. La bozza si cancella dopo l'invio.
- **Errori di invio**: messaggio comprensibile al condomino con il numero dello studio; i dati inseriti restano nel modulo.
- **Doppio invio**: dopo un invio il pulsante "Compila una nuova scheda" si attiva dopo 10 secondi.
- Il codice della scheda (`ANA-AAAAMMGG-XXXX`) viene trasmesso a Make ma non mostrato a schermo.

## Stack

- React 18 + Create React App
- Tailwind CSS 3.4
- framer-motion, lucide-react

## Pubblicazione

Repository GitHub collegato a Vercel: ogni push su `main` viene pubblicato in produzione.

# Anagrafe condominiale – v1.2

**Data:** 28/09/2026

## Schermata finale di conferma
- Dopo un invio riuscito compare una schermata dedicata "Grazie, invio completato", con spunta animata, data e ora dell'invio e la frase "Non serve inviarla di nuovo".
- Sotto, il riepilogo completo dei dati inviati: condominio, unità immobiliari (posizione, destinazione, dati catastali), dati anagrafici, recapiti e modalità di corrispondenza.
- Nessun numero di protocollo a schermo (il codice continua a essere trasmesso a Make come prima).
- Pulsante "Stampa o salva il riepilogo" (stampa pulita, senza intestazione e piè di pagina).
- La schermata resta visibile finché l'utente non preme "Compila una nuova scheda" (attivo dopo 10 secondi, per evitare doppi invii).
- Prima l'app tornava subito al passo 1 con il modulo vuoto e la conferma non si vedeva: sembrava che l'invio non fosse avvenuto.

## Invariato
- Campi, validazioni, dati trasmessi e webhook Make.

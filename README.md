# Poker Schulden

Kleine Poker-App für Android **und** iOS (Expo / React Native), die am Ende eines
Abends ausrechnet, wer wem wie viel schuldet.

## So funktioniert's

1. **Neues Spiel** – Start-Geld (Buy-in) festlegen, z.B. `10` oder `12,50`, und Spieler hinzufügen.
   Wählen, ob am Ende **Geld** oder **Chips** gezählt werden. Bei Chips wird festgelegt,
   wie viele Chips es pro Einkauf gibt (z.B. 10 € = 1.000 Chips); die App rechnet dann
   am Ende automatisch in Geld um.
2. **Spiel läuft** – Wer pleite ist, tippt auf **+ Rebuy** und kauft sich erneut für das
   Start-Geld ein. Mit **−** lässt sich ein versehentlicher Rebuy zurücknehmen
   (bzw. ein versehentlich hinzugefügter Spieler wieder entfernen).
   Spieler, die später dazukommen, können ebenfalls noch hinzugefügt werden.
   Wer früher geht, tippt auf **Aussteigen** und trägt seinen Stand direkt ein – die App
   zeigt sofort sein Ergebnis, und der Wert ist am Ende schon ausgefüllt.
   Oben steht immer, wie viel im Topf ist.
3. **Endstände** – Für jeden Spieler eintragen, wie viel Geld bzw. wie viele Chips er am
   Ende vor sich hat. Die App prüft, ob die Summe genau dem Topf entspricht, und zeigt
   sonst die Differenz an (z.B. „Es fehlen noch 100 Chips“).
4. **Abrechnung** – Die App zeigt Gewinn/Verlust pro Spieler und die **minimale Liste an
   Überweisungen** („Anna zahlt an Ben 25 €“). Mit **Ergebnis teilen** lässt sich alles
   z.B. in die WhatsApp-Gruppe schicken.

Das laufende Spiel wird automatisch auf dem Gerät gespeichert – auch wenn die App
geschlossen wird, geht nichts verloren.

## Installieren

Für alle Wege brauchst du einmalig einen Computer mit [Node.js](https://nodejs.org) (LTS)
und diesen Code (auf GitHub: **Code → Download ZIP**, entpacken). Im Projektordner:

```bash
npm install
```

### Android: echte App (APK) – kostenlos

1. Kostenloses Konto auf [expo.dev](https://expo.dev/signup) anlegen.
2. Im Projektordner:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile preview
   ```
   Fragen beim ersten Mal (Projekt anlegen, Keystore erzeugen) mit **Yes** bestätigen.
   Der Build läuft in der Expo-Cloud und dauert ca. 10–20 Minuten.
3. Am Ende gibt es einen Link und einen QR-Code. Auf dem Handy öffnen, die **.apk**
   herunterladen und antippen. Android fragt einmalig, ob der Browser „Apps aus
   unbekannten Quellen installieren“ darf → erlauben → **Installieren**.

Die APK kann man auch einfach an Freunde weiterschicken.

### iPhone: als Web-App auf dem Home-Bildschirm – kostenlos

Apple erlaubt echte Apps nur über ein kostenpflichtiges Entwicklerkonto. Die Web-Version
kann aber genauso benutzt werden:

1. Web-Version bauen:
   ```bash
   npx expo export --platform web
   ```
2. Den entstandenen Ordner `dist` online stellen, z.B. per Drag & Drop auf
   [app.netlify.com/drop](https://app.netlify.com/drop). Du bekommst eine Adresse.
3. Die Adresse auf dem iPhone in **Safari** öffnen → **Teilen** → **Zum Home-Bildschirm**.

Das funktioniert genauso auf Android. Das laufende Spiel wird auch hier auf dem Gerät gespeichert.

### iPhone: echte App (mit Apple-Entwicklerkonto)

Mit dem [Apple Developer Program](https://developer.apple.com/programs/) (99 €/Jahr):

```bash
npx eas-cli@latest device:create                     # iPhone registrieren
npx eas-cli@latest build -p ios --profile preview    # Build zum Installieren
```

### Nur mal ausprobieren: Expo Go

App **Expo Go** installieren
([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) /
[iOS](https://apps.apple.com/app/expo-go/id982107779)), dann am Computer `npm start`
und den QR-Code scannen (Handy und Computer im selben WLAN). Läuft nur, solange der
Computer an ist – für den Pokerabend also besser einer der Wege oben.

## Entwicklung

```bash
npm test           # Tests der Rechenlogik
npm run typecheck  # TypeScript prüfen
```

- `src/logic.ts` – Rechenlogik (alle Beträge in Cent, keine Rundungsfehler)
- `src/storage.ts` – Speichern des laufenden Spiels
- `App.tsx` – Oberfläche

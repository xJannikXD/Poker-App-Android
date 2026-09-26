# Poker Schulden

Kleine Poker-App für Android **und** iOS (Expo / React Native), die am Ende eines
Abends ausrechnet, wer wem wie viel schuldet.

## So funktioniert's

1. **Neues Spiel** – Start-Geld (Buy-in) festlegen, z.B. `10` oder `12,50`, und Spieler hinzufügen.
2. **Spiel läuft** – Wer pleite ist, tippt auf **+ Rebuy** und kauft sich erneut für das
   Start-Geld ein. Mit **−** lässt sich ein versehentlicher Rebuy zurücknehmen.
   Spieler, die später dazukommen, können ebenfalls noch hinzugefügt werden.
   Oben steht immer, wie viel im Topf ist.
3. **Endstände** – Für jeden Spieler eintragen, wie viel er am Ende vor sich hat.
   Die App prüft, ob die Summe genau dem Topf entspricht, und zeigt sonst die Differenz an
   (z.B. „Es fehlen noch 5 €“).
4. **Abrechnung** – Die App zeigt Gewinn/Verlust pro Spieler und die **minimale Liste an
   Überweisungen** („Anna zahlt an Ben 25 €“). Mit **Ergebnis teilen** lässt sich alles
   z.B. in die WhatsApp-Gruppe schicken.

Das laufende Spiel wird automatisch auf dem Gerät gespeichert – auch wenn die App
geschlossen wird, geht nichts verloren.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) (LTS) und die App **Expo Go** auf dem Handy
([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) /
[iOS](https://apps.apple.com/app/expo-go/id982107779)).

```bash
npm install
npm start
```

Dann den angezeigten QR-Code mit Expo Go (Android) bzw. der Kamera-App (iOS) scannen.
Im Browser geht's mit `npm run web`.

### Eigene App-Datei bauen (optional)

Mit [EAS Build](https://docs.expo.dev/build/introduction/) lässt sich eine installierbare
APK (Android) bzw. ein iOS-Build erzeugen, ohne Android Studio oder Xcode:

```bash
npx eas-cli@latest build -p android --profile preview   # APK
npx eas-cli@latest build -p ios
```

## Entwicklung

```bash
npm test           # Tests der Rechenlogik
npm run typecheck  # TypeScript prüfen
```

- `src/logic.ts` – Rechenlogik (alle Beträge in Cent, keine Rundungsfehler)
- `src/storage.ts` – Speichern des laufenden Spiels
- `App.tsx` – Oberfläche

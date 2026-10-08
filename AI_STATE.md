# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/audio-msg` — implémentation complète + 6 bugs corrigés. 385/385 tests passent. Prêt pour test sur docker dev.

---

## 1. Accomplished

### Session 7 (feature/audio-msg — implémentation)
- **`extractAudioUrl`** — `ytdlp.ts`: nouvelle fonction, semaphore partagé, in-flight dedup `audio:<url>`, format `bestaudio[ext=m4a]/bestaudio`.
- **`getAudioInfoFromUrl`** — `content-utils.ts`: SSRF guard → YouTube via yt-dlp + proxy, direct audio via HEAD `Content-Type: audio/*`, TikTok/Twitter rejetés.
- **`sendCommand` + `hidesendCommand`** — option `audio` (string, non-required), validation URL, `getAudioInfoFromUrl` en parallèle avec `measureContentProcessing`, `audioUrl`/`audioDuration` dans le JSON queue.
- **`client.html`** — `generateAudioVideo` accepte `muteVideo`, `displayContent` crée `<audio id="message-audio">`, `clearDisplay` nettoie l'élément audio.
- **i18n** — `sendCommandOptionAudio`, `hideSendCommandOptionAudio`, `invalidAudioUrl` en FR et EN.
- **Tests** — `content-utils.audio.test.ts` : 8 tests (YouTube OK/fail, direct audio, TikTok/Twitter rejetés, SSRF). 385/385 passent.

### Session 6 (develop — déjà mergé sur main)
- `allowList` rate-limit, worker sanitize, client guard, HAProxy config.

---

## 2. Bugs corrigés (code review — session 7)

| # | Fichier | Fix appliqué |
|---|---|---|
| 1 | `content-utils.ts` | Ajout `redirect: 'error'` sur HEAD fetch — bloque SSRF via redirect |
| 2 | `sendCommand.ts` / `hidesendCommand.ts` | `audioDuration` utilisé comme `finalDuration` si pas de vidéo — évite coupure à 5s |
| 3 | `client.html` | `__setVolume` itère uniquement `<audio>` (pas `<video>`) — Vidstack géré via `player.volume` |
| 4 | `client.html` | `displayMessage` : condition `!data.audioUrl` ajoutée — audio-only ne réaffiche pas l'emptyState |
| 5 | `content-utils.ts` | `probeDuration` reçoit l'URL pinnée (IP) au lieu de l'URL originale — ferme fenêtre DNS rebinding |
| 6 | `client.html` | `.play().catch()` ajouté après `appendChild(audioEl)` — fallback si autoplay bloqué (OBS) |

---

## 3. Architecture actuelle (fichiers clés feature)

| Fichier | Rôle |
|---|---|
| `src/services/ytdlp.ts` | `extractAudioUrl` + `extractVideoUrl` (clés namespaced `audio:/video:`) |
| `src/services/content-utils.ts` | `getAudioInfoFromUrl` — SSRF + YouTube + direct audio |
| `src/components/messages/sendCommand.ts` | Option `audio`, Promise.all parallèle, queue JSON avec `audioUrl` |
| `src/components/messages/hidesendCommand.ts` | Idem sendCommand |
| `src/components/client/client.html` | `generateAudioVideo(muteVideo)`, `<audio id="message-audio">`, cleanup dans `clearDisplay` |

---

## 4. Next Steps

1. **[NEXT]** Test sur docker dev (commande `/msg audio:` avec YouTube et mp3 direct)
2. **[NEXT]** PR `feature/audio-msg` → `develop` → `main`
3. **[LATER]** H-AUD-06 write-side : les 4 commandes stockent encore `media` en DB
4. **[LATER]** `displayMediaFull` — feature en attente, non prioritaire

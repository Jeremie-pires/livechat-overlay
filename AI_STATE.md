# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/audio-msg` — implémentation complète + 6 bugs corrigés + tests live passés. Prêt pour PR.

---

## 1. Accomplished

### Session 9 (feature/audio-msg — YouTube audio via Cobalt)
- **YouTube audio** — remplacé yt-dlp par Cobalt (`resolveCobaltUrl` + `downloadMode: "audio"`). Élimine le besoin de cookies YouTube.
- **`extractAudioUrl` + `_runYtdlpAudio`** supprimés de `ytdlp.ts` (dead code).
- **Tests** — 9 tests (3 YouTube Cobalt, 3 direct audio, 2 domaines rejetés, 1 SSRF). 386/386 passent. `vi.hoisted` + `vi.mock('env')` pour contrôler `COBALT_API_URL` par test.

### Session 7-8 (feature/audio-msg — implémentation + tests live)
- **`getAudioInfoFromUrl`** — `content-utils.ts`: SSRF guard → YouTube via Cobalt, direct audio via HEAD `Content-Type: audio/*`, TikTok/Twitter rejetés.
- **`sendCommand` + `hidesendCommand`** — option `audio` (string, non-required), validation URL, `getAudioInfoFromUrl` en parallèle avec `measureContentProcessing`, `audioUrl`/`audioDuration` dans le JSON queue.
- **`client.html`** — `generateAudioVideo` accepte `muteVideo`, `displayContent` crée `<audio id="message-audio">`, `clearDisplay` nettoie l'élément audio.
- **i18n** — `sendCommandOptionAudio`, `hideSendCommandOptionAudio`, `invalidAudioUrl` en FR et EN.
- **Tests** — `content-utils.audio.test.ts` : 8 tests (YouTube OK/fail, direct audio, TikTok/Twitter rejetés, SSRF). 385/385 passent.
- **CI lint fix** — import/order dans le fichier de test (node built-ins avant packages externes).

### Tests live sur docker dev (session 8)
| Test | Résultat |
|---|---|
| YouTube audio (yt-dlp extraction) | ✅ `duration: 213` extrait |
| YouTube CDN proxy | ⚠️ 403 CDN (pré-existant, même issue que vidéo) |
| Direct MP3 (soundhelix HEAD check) | ✅ `paused: false` côté client |
| emptyState caché pendant audio-only | ✅ `emptyState: none` — Bug #4 validé |
| `.play()` immédiat après append | ✅ `paused: false` — Bug #6 validé |
| `finalDuration` fallback audio | ✅ `temps:30` correctement résolu |

### Session 6 (develop — déjà mergé sur main)
- `allowList` rate-limit, worker sanitize, client guard, HAProxy config.

---

## 2. Bugs corrigés (code review — session 7)

| # | Fichier | Fix appliqué |
|---|---|---|
| 1 | `content-utils.ts` | Ajout `redirect: 'error'` sur HEAD fetch — bloque SSRF via redirect |
| 2 | `sendCommand.ts` / `hidesendCommand.ts` | `audioDuration` utilisé comme `finalDuration` si pas de vidéo |
| 3 | `client.html` | `__setVolume` itère uniquement `<audio>` (pas `<video>`) |
| 4 | `client.html` | `displayMessage` : condition `!data.audioUrl` ajoutée — audio-only ne réaffiche pas l'emptyState |
| 5 | `content-utils.ts` | `probeDuration` reçoit l'URL pinnée (IP) |
| 6 | `client.html` | `.play().catch()` ajouté après `appendChild(audioEl)` |

---

## 3. Architecture actuelle (fichiers clés feature)

| Fichier | Rôle |
|---|---|
| `src/services/ytdlp.ts` | `extractVideoUrl` uniquement (clé `video:`) |
| `src/services/content-utils.ts` | `getAudioInfoFromUrl` — SSRF + YouTube + direct audio |
| `src/components/messages/sendCommand.ts` | Option `audio`, Promise.all parallèle, queue JSON avec `audioUrl` |
| `src/components/messages/hidesendCommand.ts` | Idem sendCommand |
| `src/components/client/client.html` | `generateAudioVideo(muteVideo)`, `<audio id="message-audio">`, cleanup dans `clearDisplay` |

---

## 4. Notes techniques

- **YouTube audio via Cobalt** : `COBALT_API_URL` doit être défini dans le `.env` du container. Sans ça, YouTube audio retourne "URL audio invalide".
- **YouTube CDN 403** : URLs CDN googlevideo.com sont bound à l'IP/session — même problème que le proxy vidéo. Non-régressif.
- **ffprobe sur docker dev** : probablement non installé → `audioDuration` undefined → fallback sur `DEFAULT_DURATION=5s`. Utiliser `temps` pour forcer la durée en test.
- **Logs audio direct** : path MP3 direct n'émet aucun `logger.info` côté serveur (succès silencieux). Normal.
- **Worker logs** : `[SOCKET] New message` est `logger.debug` — non visible en mode INFO.

---

## 5. Next Steps

1. **[NEXT]** PR `feature/audio-msg` → `develop` → `main`
2. **[LATER]** H-AUD-06 write-side : les 4 commandes stockent encore `media` en DB
3. **[LATER]** `displayMediaFull` — feature en attente, non prioritaire
4. **[LATER]** YouTube CDN 403 — investiguer si yt-dlp peut extraire des URLs sans IP-binding

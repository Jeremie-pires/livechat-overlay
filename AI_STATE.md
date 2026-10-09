# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/audio-msg` — PR #72 ouvert (`feature/audio-msg` → `develop`). Fix audio mute en cours de validation live.

---

## 1. Accomplished

### Session 15 (feature/audio-msg — fix video mute quand audio overlay actif)
- **Bug** : `/msg lien: <video> audio: <audio>` → son vidéo + son audio overlay simultanés
- **Root cause** : VidstackPlayer restaure `muted`/`volume` depuis localStorage au démarrage, écrasant silencieusement `muted: true` passé à la création
- **Fix** : `generateAudioVideo` dans `client.html` splitté en deux branches :
  - `muteVideo = true` → `<video>` natif (`setAttribute('muted','')` + `volume=0`) + gardien `volumechange` qui ré-enforce le mute si overridé
  - `muteVideo = false` → VidstackPlayer inchangé (logique originale)
- Commits pushés : `bfdfd45` (tentative patches Vidstack — inefficace), `ecf67f0` (fix réel `<video>` natif)
- Rebuild VPS effectué, container `Started` — test live en attente de validation

### Session 14 (feature/audio-msg — fix yt-dlp n-challenge)
- `Dockerfile` : `node:20-alpine` → `node:22-alpine` + `yt-dlp-ejs` via pip
- `ytdlp.ts` : `--js-runtimes node` dans args `_runYtdlpAudio` et `_runYtdlp`
- Tests live confirmés ✅ (YouTube audio, direct MP3, `/cmsg`, texte+audio)

### Sessions 11–13 (feature/audio-msg — cookies + yt-dlp)
- `makeTempCookies()` : copie `:ro` cookies vers `/tmp` avant chaque appel yt-dlp
- `spawn-process.ts` : parse stdout même sur exit non-zero
- `docker-compose.yml` : volume cookies en `:ro`

### Sessions 7–10 (feature/audio-msg — implémentation audio)
- `getAudioInfoFromUrl` → YouTube via yt-dlp, direct audio via HEAD
- `sendCommand` / `hidesendCommand` : option `audio`, queue JSON `audioUrl`/`audioDuration`
- `client.html` : `<audio id="message-audio">`, queue system, clearDisplay

---

## 2. Architecture actuelle (fichiers clés)

| Fichier | Rôle |
|---|---|
| `src/components/client/client.html` | `generateAudioVideo` : branche native `<video>` si `muteVideo=true`, Vidstack sinon |
| `src/services/content-utils.ts` | `getAudioInfoFromUrl` — SSRF + YouTube yt-dlp + direct audio HEAD |
| `src/services/ytdlp.ts` | `extractVideoUrl` + `extractAudioUrl`. `--js-runtimes node`. Semaphore + in-flight dedup. |
| `src/components/messages/sendCommand.ts` | Option `audio`, Promise.all, queue JSON `audioUrl`/`audioDuration` |
| `src/components/messages/hidesendCommand.ts` | Idem |
| `Dockerfile` | `node:22-alpine` builder+runner, `yt-dlp yt-dlp-ejs` via pip |

---

## 3. Next Steps

### [NEXT] Valider fix video mute
- Tester `/msg lien: <url_video> audio: <url_audio>` — seul l'audio overlay doit être audible
- Si OK → merger PR #72 (`feature/audio-msg` → `develop`) puis `develop` → `main`

### [LATER]
- H-AUD-06 : 4 commandes stockent encore `media` en DB au lieu de `audio`
- `displayMediaFull` — non prioritaire

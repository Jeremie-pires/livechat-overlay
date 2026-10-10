# AI_STATE.md — LiveChat CCB

## Status
Branch `develop` — `feature/audio-msg` mergé dans `develop` ✅. Tests live validés.

---

## 1. Accomplished

### Session 17 (develop — Sonar duplication 7.6% → < 3%)
- `content-utils.audio.test.ts` : merge `spawnNoOutput` → `spawnExitCode(code = 0)`, `Object.fromEntries` pour logger mock (évite bloc 10 lignes dupliqué avec cobalt/content-utils tests), `logMock.X` direct à la place des type casts répétés
- 224 → 175 lignes, 3 sources de duplication éliminées

### Session 16 (feature/audio-msg — Sonar fixes + README)
- `hidesendCommand.ts` : refactor handler → extracte `replyError`, `validateInputs`, `parseCustomDuration`, `computeFinalDuration` — complexité cognitive 23 → ~7
- `loader.ts` : export `I18nKey = Parameters<RosettyI18n['t']>[0]` pour typage strict des helpers
- `ytdlp.ts` : `Math.random()` → `randomUUID()` (node:crypto) — fix Sonar pseudorandom warning
- `Dockerfile` : `pip3 install` + `--only-binary :all:` + contraintes `>=2024.11.4` / `>=0.1.0`
- `README.md` : section détaillée option `audio` pour `/msg` / `/cmsg` (sources, exemples, durée auto)

### Session 15 (feature/audio-msg — fix video mute quand audio overlay actif)
- **Bug** : `/msg lien: <video> audio: <audio>` → son vidéo + son audio overlay simultanés
- **Fix** : `generateAudioVideo` dans `client.html` → branche `<video>` natif si `muteVideo=true` (setAttribute muted + gardien volumechange)
- Tests live validés ✅

### Session 14 (feature/audio-msg — fix yt-dlp n-challenge)
- `Dockerfile` : `node:20-alpine` → `node:22-alpine` + `yt-dlp-ejs` via pip
- `ytdlp.ts` : `--js-runtimes node` dans args `_runYtdlpAudio` et `_runYtdlp`

### Sessions 7–13 (feature/audio-msg — implémentation audio complète)
- `getAudioInfoFromUrl` → YouTube via yt-dlp, direct audio via HEAD
- `sendCommand` / `hidesendCommand` : option `audio`, queue JSON `audioUrl`/`audioDuration`
- `client.html` : `<audio id="message-audio">`, queue system, clearDisplay
- `makeTempCookies()` + volume cookies `:ro` + spawn stdout non-zero fix

---

## 2. Architecture actuelle (fichiers clés)

| Fichier | Rôle |
|---|---|
| `src/components/client/client.html` | `generateAudioVideo` : branche native `<video>` si `muteVideo=true`, Vidstack sinon |
| `src/services/content-utils.ts` | `getAudioInfoFromUrl` — SSRF + YouTube yt-dlp + direct audio HEAD |
| `src/services/ytdlp.ts` | `extractVideoUrl` + `extractAudioUrl`. `--js-runtimes node`. `randomUUID()` pour temp cookies. |
| `src/components/messages/sendCommand.ts` | Option `audio`, Promise.all, queue JSON `audioUrl`/`audioDuration` |
| `src/components/messages/hidesendCommand.ts` | Idem + helpers extraits (complexité Sonar OK) |
| `src/services/i18n/loader.ts` | `I18nKey` exporté |
| `Dockerfile` | `node:22-alpine` builder+runner, `yt-dlp yt-dlp-ejs` via pip `--only-binary :all:` |

---

## 3. Next Steps

### [NEXT]
- Merger `develop` → `main`

### [LATER]
- H-AUD-06 : 4 commandes stockent encore `media` en DB au lieu de `audio`
- `displayMediaFull` — non prioritaire

# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/audio-msg` — PR #72 ouvert (`feature/audio-msg` → `develop`). Root cause n-challenge identifiée et corrigée. En attente de rebuild Docker + test live.

---

## 1. Accomplished

### Session 15 (feature/audio-msg — fix video mute when audio overlay active)
- Bug : vidéo + audio overlay jouaient leurs sons simultanément — VidstackPlayer ne garantit pas la persistance de `muted: true` après `player.play()`
- Fix : `client.html` `generateAudioVideo` — enforce `player.muted = true` + `videoEl.muted = true; videoEl.volume = 0` à 3 points : après create, dans `loaded-metadata`, dans `can-play` avant `player.play()`

### Session 14 (feature/audio-msg — fix yt-dlp n-challenge: node:22 + --js-runtimes)
- Root cause n-challenge identifiée : `NodeJsRuntime.MIN_SUPPORTED_VERSION = (22, 0, 0)` dans `_jsruntime.py` → node:20 → `is_available() = False` → "node (unavailable)"
- `Dockerfile` : `node:20-alpine` → `node:22-alpine` (builder + runner). Ajout `yt-dlp-ejs` au pip install.
- `ytdlp.ts` : ajout `'--js-runtimes', 'node'` dans les args de `_runYtdlpAudio` et `_runYtdlp`.
- Changements commités, rebuild VPS requis.

### Session 13 (feature/audio-msg — fix temp cookies copy)
- Root cause finale : yt-dlp (même 2026.08.19 via pip) tente d'écrire le cookie-jar en teardown → `OSError: [Errno 30] Read-only file system` → stdout vide → extraction échoue
- Fix : `ytdlp.ts` — `makeTempCookies()` copie `/cookies/cookies.txt` dans `/tmp/ytdlp-cookies-<id>.txt` avant chaque appel. yt-dlp écrit dans le temp, le vrai fichier reste intact. Temp supprimé en `finally`.
- Appliqué aux deux fonctions : `_runYtdlpAudio` et `_runYtdlp`

### Session 12 (feature/audio-msg — fix cookies + docker volume)
- Diagnostiqué : yt-dlp écrasait `cookies.txt` via comportement cookie-jar → perte des cookies YouTube auth
- `docker-compose.yml` + `docker-compose.dev.yml` : volume `./cobalt-cookies` → `./cobalt-cookies/cookies.txt:/cookies/cookies.txt:ro` (fichier seul, lecture seule)
- Cookies restaurés manuellement sur VPS avec les cookies YouTube complets (SID, SSID, HSID, SAPISID, LOGIN_INFO, etc.)
- yt-dlp mis à jour via pip (`pip3 install --break-system-packages yt-dlp` → 2026.08.19) car version apk trop ancienne (2026.03.17) bloquée par YouTube

### Session 11 (feature/audio-msg — retour yt-dlp audio)
- Restauré `extractAudioUrl` + `_runYtdlpAudio` dans `ytdlp.ts` (supprimés au commit `6cc72a6`)
- `getAudioInfoFromUrl` dans `content-utils.ts` : bloc Cobalt remplacé par `extractAudioUrl(url, env.YTDLP_COOKIES)`
- Tests `content-utils.audio.test.ts` : mocks Cobalt → mocks yt-dlp spawn
- 386/386 tests passent
- Phase test live en cours : erreurs cookies yt-dlp attendues (YTDLP_COOKIES non configuré)

### Session 10 (feature/audio-msg — fix Cobalt tunnel + diagnostic)
- **Bug fix** (`3fca5cc`): `probeDuration(streamUrl)` supprimé du chemin Cobalt dans `getAudioInfoFromUrl`. Tunnel single-use n'est plus consommé par ffprobe.
- **Tests live** :
  - `texte + audio (YT dQw4w9WgXcQ)` ✅ — cobalt extraction succeeded
  - `lien + audio + texte` ✅ — plus de 404 immédiate (tunnel préservé)
  - `audio only (direct MP3 soundhelix)` ✅
  - `/cmsg audio (YT) + texte` ✅ éphémère confirmé
- **Diagnostic Cobalt** (via `docker exec node`): seul `dQw4w9WgXcQ` passe. Toutes les autres URLs YouTube → `error.api.youtube.login`. Cobalt ne peut pas extraire sans session YouTube authentifiée.
- **PR #72** créé (`feature/audio-msg` → `develop`).

### Session 9 (YouTube audio via Cobalt)
- `resolveCobaltUrl` + `downloadMode: "audio"`. `extractAudioUrl` supprimé de `ytdlp.ts`.
- 9 tests unitaires. 386/386 passent.

### Session 7-8 (implémentation audio)
- `getAudioInfoFromUrl` : SSRF guard → YouTube via Cobalt, direct audio via HEAD.
- `sendCommand` / `hidesendCommand` : option `audio`, queue JSON avec `audioUrl`/`audioDuration`.
- `client.html` : `<audio id="message-audio">`, muteVideo, cleanup, emptyState masqué en audio-only.
- 6 bugs corrigés (code review).

---

## 2. Architecture actuelle (fichiers clés)

| Fichier | Rôle |
|---|---|
| `src/services/content-utils.ts` | `getAudioInfoFromUrl` — SSRF + YouTube via yt-dlp + direct audio HEAD |
| `src/services/ytdlp.ts` | `extractVideoUrl` + `extractAudioUrl` (restauré). Semaphore + in-flight dedup pour les deux. |
| `src/components/messages/sendCommand.ts` | Option `audio`, Promise.all, queue JSON `audioUrl`/`audioDuration` |
| `src/components/messages/hidesendCommand.ts` | Idem |
| `src/components/client/client.html` | `<audio id="message-audio">`, muteVideo, clearDisplay |

---

## 3. Bugs / Next Steps

### [NEXT] Rebuild container VPS + test live (audio mute fix)
- `docker compose -f docker-compose.dev.yml build --no-cache livechatccb-dev && docker compose -f docker-compose.dev.yml up -d --force-recreate livechatccb-dev`
- Tester : `/msg lien: <url_video> audio: <url_audio>` — vérifier que seul l'audio overlay joue, pas le son de la vidéo

### [NEXT] Merger PR #72 puis `develop` → `main`

---

### [LATER]
- H-AUD-06 : 4 commandes stockent encore `media` en DB
- `displayMediaFull` — non prioritaire

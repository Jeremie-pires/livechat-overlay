# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/audio-msg` — PR #72 ouvert (`feature/audio-msg` → `develop`). yt-dlp audio restauré (Cobalt retiré du chemin YouTube). En attente de cookies yt-dlp pour que l'extraction YouTube fonctionne.

---

## 1. Accomplished

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

### [NEXT] Ajouter les cookies yt-dlp
- Configurer `YTDLP_COOKIES` dans le `.env` du VPS (chemin vers `cookies.txt` YouTube)
- Format Netscape (`# Netscape HTTP Cookie File`) — exportable depuis l'extension browser `Get cookies.txt`
- Une fois configuré, relancer un test live `/msg audio: <URL YouTube>` pour confirmer l'extraction

### [NEXT] Merger PR #72 puis `develop` → `main`

---

### [LATER]
- H-AUD-06 : 4 commandes stockent encore `media` en DB
- `displayMediaFull` — non prioritaire

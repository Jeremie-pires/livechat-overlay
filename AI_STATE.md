# AI_STATE.md — LiveChat CCB

## Status
Branch `feature/audio-msg` — implémentation complète + 7 bugs corrigés + tests live passés. Prêt pour PR.

---

## 1. Accomplished

### Session 10 (feature/audio-msg — fix Cobalt tunnel bug)
- **Bug fix** (`3fca5cc`): `probeDuration(streamUrl)` supprimé du chemin Cobalt audio dans `getAudioInfoFromUrl` (`content-utils.ts` ~ligne 519). ffprobe consommait le tunnel single-use avant que le client puisse le lire → 404 video-proxy.
- **Docker rebuild** déployé sur dev container.
- **Tests live confirmés** :
  - `texte + audio (YT)` ✅ — cobalt extraction succeeded, audio lu
  - `lien + audio + texte` ✅ — tunnel préservé (plus de 404 immédiate liée à probeDuration)
  - `audio only (direct MP3)` ✅ — Succès
  - `/cmsg audio (YT) + texte` ✅ — Succès + réponse éphémère confirmée
- **Finding** : Cobalt tunnel TTL ≈ 90s. Si délai queue > 90s (ex: yt-dlp lent sur lien YouTube), audio expire silencieusement. Problème distinct du bug probeDuration — non bloquant pour le PR.

### Session 9 (feature/audio-msg — YouTube audio via Cobalt)
- YouTube audio via Cobalt (`resolveCobaltUrl` + `downloadMode: "audio"`). `extractAudioUrl` supprimé de `ytdlp.ts`.
- 9 tests unitaires. 386/386 passent.

### Session 7-8 (feature/audio-msg — implémentation + tests live)
- `getAudioInfoFromUrl` : SSRF guard → YouTube via Cobalt, direct audio via HEAD, TikTok/Twitter rejetés.
- `sendCommand` + `hidesendCommand` : option `audio`, Promise.all parallèle, `audioUrl`/`audioDuration` dans queue JSON.
- `client.html` : `generateAudioVideo(muteVideo)`, `<audio id="message-audio">`, cleanup dans `clearDisplay`.
- 6 bugs corrigés (code review session 7).

---

## 2. Architecture actuelle (fichiers clés)

| Fichier | Rôle |
|---|---|
| `src/services/content-utils.ts` | `getAudioInfoFromUrl` — SSRF + YouTube via Cobalt + direct audio. `probeDuration` NON appelé sur tunnel Cobalt. |
| `src/services/ytdlp.ts` | `extractVideoUrl` uniquement |
| `src/components/messages/sendCommand.ts` | Option `audio`, queue JSON avec `audioUrl`/`audioDuration` |
| `src/components/messages/hidesendCommand.ts` | Idem sendCommand |
| `src/components/client/client.html` | `<audio id="message-audio">`, cleanup, emptyState masqué en audio-only |

---

## 3. Notes techniques

- **Cobalt tunnel TTL** : ~90s. Si `Promise.all(yt-dlp lien, cobalt audio)` + délai queue > 90s → audio 404 silencieux. Fix potentiel : re-fetch Cobalt à la déqueue (non implémenté).
- **YouTube CDN 403** : URLs googlevideo.com bound à l'IP — pré-existant, non-régressif.
- **`audioDuration`** : retourne `undefined` pour Cobalt (tunnel non sondé) → fallback `DEFAULT_DURATION=5s` ou param `temps`.

---

## 4. Next Steps

1. **[NEXT]** PR `feature/audio-msg` → `develop` → `main`
2. **[LATER]** H-AUD-06 write-side : 4 commandes stockent encore `media` en DB (pas `audioUrl`/`audioDuration`)
3. **[LATER]** Re-fetch Cobalt à la déqueue pour éviter expiry tunnel > 90s
4. **[LATER]** `displayMediaFull` — non prioritaire

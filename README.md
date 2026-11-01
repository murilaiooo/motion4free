# Motion4Free

**Make short videos worth watching. Edit them right in your browser.**

Motion4Free is a free, open-source video editor for Reels, YouTube Shorts, TikTok, and other social videos. Cut footage, add word-synced captions, build a look that fits your content, and export an MP4 without installing an editor or creating an account.

**No account. No watermark. No required subscription.**

[**Open Motion4Free**](https://motion4free.murdokmurilo1.workers.dev/) · [Português (Brasil)](README.pt-BR.md) · [See the styles](https://motion4free.murdokmurilo1.workers.dev/?galeria) · [Report an issue](https://github.com/murilaiooo/motion4free/issues)

> **Current release:** Motion4Free is in active development. You can try the web app now, but real-world video quality, browser compatibility, and some release checks are still being evaluated. [Read the latest test report](docs/reviews/2026-10-30-v031-testes.md).

## What can you make?

### Edit your own videos

Bring short recordings together, trim what drags, fix the captions, and shape the pacing yourself. Start with a visual style or describe the edit you have in mind. You can keep adjusting every part before exporting.

- Import up to 30 short clips, each up to 3 minutes.
- Cut, split, rearrange, duplicate, and undo edits on a real timeline.
- Move captions and visual elements in the preview.
- Export vertical, portrait, square, or widescreen MP4.

### Turn long videos into short clips

Have a podcast, interview, class, or recorded stream? The Clip Creator works with local video files from 2 minutes to 2 hours. It transcribes the recording and proposes moments to review. You choose the excerpts, check the surrounding context, adjust the boundaries, and download individual clips or open them in the editor.

Suggestions come from local rules by default. Optional AI analysis can help with selection, but it may be unavailable or fall back to local suggestions. **Review the meaning of every cut before publishing.** The app does not promise virality or automatically guarantee a complete story.

## Make it look like yours

Motion4Free includes editable visual styles, animated typography, word-level emphasis, and layouts for spoken videos. Use a style as a starting point, then change the text, timing, position, and framing to fit your footage.

These are examples from Motion4Free's own style gallery:

**Pop**
![Pop style: bold, energetic captions and motion graphics](docs/assets/fase3/pop.png)

**Editorial**
![Editorial style: refined typography and restrained layouts](docs/assets/fase3/editorial.png)

**Documentary**
![Documentary style: clear titles, captions and information graphics](docs/assets/fase3/documental.png)

[Explore more styles in the live gallery](https://motion4free.murdokmurilo1.workers.dev/?galeria).

## The tools you need, without the clutter

| Feature | What it does |
| --- | --- |
| **Speech-to-text captions** | Transcribe speech with on-device Whisper, edit individual words, and keep captions timed to the voice. Model downloads and performance depend on your hardware. |
| **Timeline editing** | Trim, split, reorder, and review footage with an audio waveform, plus undo and redo. |
| **Motion and text** | Work with styles, title cards, animated emphasis, overlays, and on-screen positioning. |
| **Flexible formats** | Export 9:16 (Reels/Shorts/TikTok), 4:5, 1:1, or 16:9. |
| **Creative assistance** | Start from guided choices, a written instruction, local rules, or optional AI. Review and change the result. |
| **Projects and backups** | Return to a project saved in this browser and export a portable `.m4f` backup containing the project and copied media. |
| **Local MP4 export** | Render and download on your device, without a Motion4Free watermark. Actual codec support depends on the browser and computer. |

## Get started

1. [Open the web editor](https://motion4free.murdokmurilo1.workers.dev/) in **Brave, Chrome, or Edge on a desktop computer**.
2. Choose **Editar meus vídeos** (edit my videos) or **Clipes de vídeo longo** (long-video clips).
3. Select video files you own or are authorized to edit. The interface accepts common formats such as MP4, MOV, and WebM; the underlying codec must also be supported by your browser.
4. Pick a style, review the cuts and captions, and make any changes you want.
5. Export your MP4. For projects you want to keep, download a `.m4f` backup.

The **app interface is currently in Brazilian Portuguese**. This English README is here to help international users explore the project. Direct YouTube-link importing is not supported; use a video file you have the right to edit.

## Free editing, with clear privacy choices

Motion4Free processes your video locally by default. There is no Motion4Free account or project-upload server. Your saved projects live in your browser's local storage (OPFS), not in a cloud account.

AI is optional:

- **Local mode:** transcription and supported processing run on your device. Some models must be downloaded first, and demanding models may require a capable GPU.
- **External AI:** if you connect your own API key, the browser can send selected transcript text or speech audio directly to the chosen provider **only through the corresponding opt-in flow**. Text-sharing and audio-sharing permissions are separate. Provider terms, usage limits, and charges apply.
- **No API key required:** you can still edit, use styles and local rules, and export. A ChatGPT or Claude subscription does not automatically include API credits.

**Keep your backups.** Browsers can clear local data when storage is limited or a profile is removed. A `.m4f` backup contains your media and transcript and is **not encrypted**. Store it somewhere private.

## Run it locally

For developers: Node.js 22 or a compatible version and npm. FFmpeg is needed to generate synthetic test fixtures, not to use the hosted web editor.

```bash
git clone https://github.com/murilaiooo/motion4free.git
cd motion4free
npm ci
npm run dev
```

Open `http://localhost:5173`.

```bash
npm run typecheck
npm test
npm run build
npm run fixture   # requires FFmpeg
npm run e2e       # Playwright; browser configuration may be needed
```

The app uses TypeScript, React, Vite, Mediabunny, and Transformers.js. [Development guide](CONTRIBUTING.md) · [Architecture and research](docs/INDEX.md) · [Release status](docs/release/STATUS.md) · [Changelog](docs/CHANGELOG.md)

## Open source, with room to grow

Motion4Free is under active development. Reports about broken workflows, confusing screens, codecs, captions, and exports are welcome in [GitHub Issues](https://github.com/murilaiooo/motion4free/issues). Please don't attach private footage, transcripts, or API keys to a public issue. For sensitive reports, see [Security](SECURITY.md).

The Motion4Free source code is released under the [MIT License](LICENSE). Third-party libraries, fonts, models, and assets retain their own licenses and notices; see [Third-party licenses](docs/licencas.md). Use only footage and audio you have permission to edit and publish.

# Impeccable integration and first UX review

**Date:** October 30, 2026  
**Product:** Motion4Free v0.31.0, production build `2a5e3ec`  
**Scope:** Existing first-run journey, settings, homepage, and source-level editor inspection.  
**Status:** Initial evidence-backed review, not a completed usability study or a certification of accessibility.

## Integration

[Impeccable](https://github.com/pbakaus/impeccable) v4.8.0 is installed as *development tooling*, not as a dependency shipped to visitors.

- Codex skill and design references: `.agents/skills/impeccable/`
- GitHub Copilot skill and specialized agent definitions: `.github/skills/impeccable/`, `.github/agents/`
- Local design-check hooks: `.codex/hooks.json`, `.github/hooks/impeccable.json`
- The Windows engine was downloaded for the local review, but executables are intentionally **not committed**. Each supported developer environment resolves its own engine on first use.
- Existing `AGENTS.md`, Matt Pocock skills, design decisions, and app dependencies remain in place. No GitHub Actions were activated.

Useful targeted commands (from a project-aware coding agent):

```text
$impeccable critique the six-step CreativeSetup onboarding
$impeccable onboard the first-video import flow
$impeccable distill the settings interface for first-time users
$impeccable audit the editor workspace
$impeccable polish the landing page
```

The root `PRODUCT.md` already exists. Impeccable reports that its schema is older than its current product-record format. Do not rewrite it automatically. A root `DESIGN.md` does not yet exist; use `docs/design-system.md` and `docs/decisions/0015-novo-visual.md` as incumbent visual truth until design documentation is explicitly refreshed.

## Review method and limits

1. Navigated the live production site in a clean browser session, inspecting the homepage and every step of the six-step guided editor setup.
2. Inspected Settings, including its AI routing and Editor & Appearance sections.
3. Read `src/app/production/CreativeSetup.tsx`, `src/app/settings/SettingsScreen.tsx`, `src/app/settings/AiRouting.tsx`, `src/app/Editor.tsx`, and `src/app/workbench/EditorWorkspace.tsx`.
4. Ran Impeccable's source detector against `src/app`: **three findings**, consisting of one accent-border warning and two easing advisories in `src/app/production/production.css`.
5. Ran its rendered homepage detector against the public production URL: it emitted **22 candidate findings** (nine identical feature-card icon-tile patterns, five decorative section-number patterns, six isolated last-line words, one contrast advisory, and one stripe-gradient advisory). The detector process exited with code 1 despite producing JSON; treat this as a partial diagnostic, not as a clean formal pass.

**Not reviewed:** the loaded media editor, its timeline under realistic footage, the post-transcription clip review screen, actual video export, responsive breakpoints, screen-reader usage, and human task completion. Existing GitHub issues about those surfaces remain active evidence, not verified fixes.

## Priority findings

### P1: Six decisions before a first-video import

**Evidence:** `CreativeSetup.tsx` presents Destination → Editing → Duration → Visual → Captions → Review, then the file picker. A persistent “Skip and choose videos” action exists, but the six-step journey is visually dominant. Several option cards extend below the fold on a typical desktop viewport.

**User cost:** A new visitor must make production decisions without having seen their own footage in the editor. The default journey delays the first meaningful result.

**Direction:** Make the default path **select media → confirm a lightweight starting point → review first draft**. Offer a clearly labeled “Customize before editing” branch for people who want all six decisions up front. Retain all existing choices, their persistence, and the ability to revise them later.

**Acceptance:**
- A first-time user can reach the file picker without completing the full wizard.
- The quick path makes the applied format, cut policy, caption mode, and privacy behavior clear.
- Returning users retain prior selections. Skipping never silently enables external AI or uploads.
- Test first-use, back/forward, keyboard focus, and a 1366×768 viewport.

### P1: Duplicated platform and aspect-ratio decisions

**Evidence:** The Destination step offers six destination cards followed by four output-ratio options. Selecting a platform already selects a default ratio, while the second group can override it.

**User cost:** Ten competing choices on the same screen and an unnecessary distinction for a casual creator.

**Direction:** Ask for the publishing destination once, show its resulting format, and put manual aspect ratio under “Change format”. Make overrides explicit and consistent, including horizontal YouTube versus 9:16 Shorts.

**Acceptance:** One unambiguous active ratio, visible confirmation of overrides, no hidden reset when navigating between steps.

### P1: Editor needs a task-first hierarchy check

**Evidence:** `Editor.tsx` exposes rail tabs for models, text, elements, captions, media, audio, AI, versions, and colors, plus preview, inspector, and timeline. `EditorWorkspace.tsx` implements resizable/collapsible panels and a reset affordance in Settings. This is **code-level evidence only**, not a visual defect diagnosis.

**Direction:** Review the loaded workspace at 1366×768 and laptop sizes. Protect preview size, reveal the primary edit and export actions, and make advanced panels discoverable but unobtrusive. Validate against [#82](https://github.com/murilaiooo/motion4free/issues/82), which already documents preview crowding. Do not rebuild the editor without reproducing the actual workspace first.

**Acceptance:** Preview remains usable when notices appear; primary edit actions, timeline, undo, and export can be found without training; panel reset is discoverable; no data loss from layout changes.

### P1: Clip-review redesign remains its own tracked problem

The known overlap and hierarchy concerns belong to [#147](https://github.com/murilaiooo/motion4free/issues/147). This review did **not** load a long video or reproduce that screen. Follow the existing issue and perform its focused visual review after a representative authorized fixture is available. Preserve contextual evidence before changing clip selection controls.

### P2: Settings explain cost better but still use expert vocabulary

**Evidence:** The current Settings modal has six clear sections and three AI modes: “Só regras”, “IA no navegador”, and “Usar minha API”. The browser model card introduces WebGPU without explaining compatibility or what happens when the hardware is unsupported.

**Direction:** Keep the understandable three-choice entry. Explain hardware capability in ordinary language, show a short compatibility check where the choice is made, and put provider keys, routing, quotas, and consent behind progressive disclosure. Preserve the distinction between configured model and the model actually used. Coordinate with [#126](https://github.com/murilaiooo/motion4free/issues/126) and [#146](https://github.com/murilaiooo/motion4free/issues/146), not a duplicate issue.

**Acceptance:** A novice can choose local/free/API without knowing WebGPU or API terminology; provider costs and opt-in text/audio permissions remain explicit; a test button reports real readiness and actionable failures.

### P2: Homepage has repeated generated-UI motifs

**Evidence:** The rendered detector flagged nine similarly constructed feature-card icon tiles and five numbered section markers. It also measured one text pair at **4.2:1**, slightly below a **4.5:1** normal-text target. Six orphaned words were flagged as typography advisories. The striped decoration may be intentional and needs human review.

**Direction:** Keep Motion4Free's existing dark/yellow identity. Reduce decorative repetition in the feature grid, improve the particular contrast pair, and refine text wrapping. Treat generic “AI slop” heuristics as prompts for judgment, not grounds for automatic deletion.

**Acceptance:** Visual hierarchy feels purposeful, text passes a real rendered contrast check, and no meaningful feature description disappears.

## Order of execution

1. Guided onboarding and destination/ratio consolidation (high leverage, contained scope).
2. Focused settings comprehension and AI-readiness improvements under #126/#146.
3. Realistic editor workspace review and preview fixes under #82.
4. Clip-review screen work under #147 with fixture-based evidence.
5. Landing-page visual cleanup and responsive/accessibility checks.
6. One final cross-surface `audit`, `harden`, and `polish` pass, using local tests and browser validation, not GitHub Actions.

For each implementation increment: preserve product behavior and local-first privacy; create a focused branch/PR; execute relevant local typecheck, tests, build, and browser checks; provide a plain-language manual test script. No production deploy or merge is implied by this report.

## License and provenance

Impeccable is by [Paul Bakaus](https://github.com/pbakaus/impeccable), licensed under [Apache-2.0](https://github.com/pbakaus/impeccable/blob/main/LICENSE). Source and generated skill files were installed with its own project-level installer. The tool is not bundled into the Motion4Free web app, and its detection results are not guarantees of accessibility or design quality.

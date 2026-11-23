# Three Realms: English Quest

A browser-based top-down action RPG built with Phaser 3, TypeScript, and Vite. In **Chapter 1 — The Awakening of Wind**, teenage ninja Eiku trains in Hidden Bamboo Village. The village and characters use original placeholder artwork drawn in Phaser.

## Run locally

Use Node.js 20.19+ or 22.12+ (modern LTS recommended) and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For an iPad or iPhone on the same network, open the displayed network URL in Safari and rotate to landscape. The development server listens on all interfaces, so use a trusted network. No account, API key, or external service is required.

```sh
npm run build
npm run preview
```

The build type-checks the project and emits static files into `dist/`. Preview serves that production build. For a clean install from the committed lockfile, use `npm ci`.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move in four directions | WASD or arrow keys | Left joystick |
| Sword slash in facing direction | J | 揮劍 |
| Dodge in facing direction | Space | 閃避 |
| Talk to Elder Geno / advance dialogue | E | 對話 / 繼續 |

## Test the playable route

1. Open the title screen and select **進村探險**.
2. Follow the path north. Press **E** or **對話** near Elder Geno. Close his dialogue and check that the objective changes to practicing on the straw dummy.
3. Walk east to the straw dummy, face it, and slash within range. The dummy recoils and the HUD displays **風之訓練完成！**. Reload and enter again to check that the objective persists. Clear this site's local storage to restart the chapter objectives.
4. Move against a hut to check collision. Walk onto the thorn patch southwest of the spawn to lose health. Check that a dodge moves Eiku faster, briefly protects him from damage, and has a cooldown. At zero health, Eiku respawns at the starting point with full health.
5. Repeat on iPad and iPhone Safari in landscape. Check joystick release, pressing an action while holding the joystick, and visibility of the HUD, dialogue, and controls near the screen edges.

## Code layout

- `src/scenes` contains the title and village scenes and village artwork.
- `src/entities`, `src/combat`, and `src/input` contain character state, sword behavior, and keyboard and touch input.
- `src/quests`, `src/progression`, and `src/save` contain chapter metadata, training steps, and versioned local storage.
- `src/speech` defines the speech recognition contract for a future implementation.
- `src/i18n/zh-TW.ts` contains the Taiwanese Traditional Chinese game text. Use `data-text` and `data-label` for markup, and import `messages` for dynamic text. Keep save identifiers and intentional English-learning content independent of UI translations.

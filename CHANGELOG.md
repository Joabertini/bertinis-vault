# Changelog

## [0.2.2] — 2026-08-25

### Fixed
- The import no longer opens any Plutonium window. It ran the Charactermancer,
  asked for class levels, and asked whether to use the importer; a character
  now arrives exactly as it was built.

  Three earlier attempts made *building* the document silent and missed where
  the windows came from. Plutonium registers a `preCreateItem` hook per prop and
  intercepts any item created on an actor that carries its flags — which the
  documents it builds do. Every document is now marked
  `flags.plutonium.isDirectImport`, the hook's own escape.

  The module also calls Plutonium's converters directly rather than its
  importers. Converters are pure functions; importers are the interactive layer.
- Plutonium is no longer reported as missing when it is installed and active.
  Its API was read from `game.modules.get("plutonium").api`, which Plutonium
  assigns at the end of an un-awaited async `ready` handler — after ours, since
  Foundry fires module hooks in id order. It now reads `globalThis.plutonium`,
  assigned when the bundle loads.
- Class items arrive at the level the payload asked for, and with the
  proficiency advancement their class grants. Both were being answered by a
  prompt before.
- Imported items keep their book out of their name, so equipped and prepared
  state finds them again.

### Added
- `test/plutonium-bundle.test.mjs` asserts what this module assumes about
  Plutonium against `Bundle.js` itself rather than a fixture. Set
  `PLUTONIUM_DIR` to run it; without it the tests skip.
- `src/window-watch.js` reports anything that opens a window during an import,
  with its class, title and stack.

## [0.1.0] — 2026-03-21

### Initial release
- 9-step character creation wizard
- All 13 D&D 5e 2014 classes with subclasses
- All races with subraces
- Backgrounds from PHB + supplements with automatic feat assignment
- 3-set dice roller (one roll, choose set)
- Standard Array, Point Buy (27 pts), Manual entry
- Proficiency-filtered armor and weapon selection
- ASI/Feat tracking per class level
- Spell slot calculation (full, half, pact casters)
- Direct actor creation via Foundry API (dnd5e 5.x schema)
- Spanish and English localization
- GM-only mode setting

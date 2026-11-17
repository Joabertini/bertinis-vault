"""Arma el pack de íconos de la Forja.

Salidas:
  apps/web/public/icons/atlas.webp            hoja de sprites, celdas de CELL px
  packages/forge/src/icon-atlas.ts            claves, posiciones y trazos de siluetas
  apps/web/public/icons/CREDITS.txt           autores y licencias

Uso:  python tools/icon-atlas/build.py [--cache DIR]

Descarga las fuentes (todas de licencia libre, ver CREDITS) a la caché y las
recorta. Requiere Pillow. No hace falta ejecutarlo para compilar la Forja: sus
salidas están versionadas.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CELL = 96
COLS = 10
OGA = "https://opengameart.org/sites/default/files/"
GI = "https://raw.githubusercontent.com/game-icons/icons/master/"

# --- RPG Icons Set (CC0): hoja de 16x16 celdas de 64 px, índice = fila*16 + columna. ---
RPG = {
    "sword": 26, "greatsword": 77, "dagger": 80, "axe": 79, "handaxe": 116, "battleaxe": 13, "mace": 88,
    "hammer": 78, "warhammer": 90, "bow": 76, "crossbow": 82, "arrow": 8, "arrows": 16,
    "staff": 84, "wand": 81, "shield": 27, "helm": 41, "hood": 20, "hat": 33,
    "armor": 44, "armor-cloth": 32, "armor-dark": 36, "armor-leather": 23,
    "boots": 22, "boots-plate": 43, "gloves": 21, "gloves-plate": 42, "belt": 24, "cloak": 25,
    "ring": 29, "ring-green": 72, "amulet": 28, "amulet-green": 68,
    "potion-red": 17, "potion-blue": 18, "potion-yellow": 45, "potion-green": 46, "potion-pink": 47, "vial": 152,
    "scroll": 143, "scroll-red": 144, "scroll-green": 147, "parchment": 153,
    "book-red": 133, "book-blue": 134, "book-green": 135, "book-holy": 150, "book-arcane": 151, "tome": 83,
    "bag": 110, "bag-gold": 112, "coin": 159, "gem-red": 118, "gem-blue": 119, "gem-green": 120,
    "gem-amber": 121, "gem-violet": 122, "gem-white": 123, "ingot": 12, "ingot-gold": 49,
    "bread": 167, "tankard": 164, "meat": 166, "cheese": 188, "chicken": 240, "stew": 162,
    "key": 154, "key-gold": 158, "pickaxe": 115, "sickle": 117, "barrel": 242, "logs": 244,
    "rune-fire": 5, "fireball": 203, "tornado": 204, "pentagram": 109, "heal-cross": 1, "heal-hand": 6,
    "praying": 234, "holy-shield": 235, "fist": 198, "spark": 189,
}
# --- Fantasy RPG Icons 1-3, Drummyfish (CC0), por nombre de archivo. ---
DRUM = {
    "chest": "icon_chest", "crossbow-d": "icon_crossbow", "helmet-gold": "icon_helmetgold",
    "knight-shield": "icon_knightshield", "magic-sword": "icon_magicsword", "magic-dagger": "icon_magicdagger",
    "money-gold": "icon_moneygold", "crystal": "icon_crystalblue", "dragon": "icon_dragon", "orc": "icon_orc",
    "bigcat": "icon_bigcatwhite", "bird": "icon_birdblue", "skull": "icon_skull", "leaf": "icon_leaf",
    "venom": "icon_venom", "legarmor": "icon_legarmor", "glove": "icon_glove", "ring-magic": "icon_ringmagic",
    "frostball": "icon_frostball", "spell-heal-d": "icon_spellheal", "book-holy-d": "icon_bookholy",
    "armor-gold": "icon_armorgold", "sword-blood": "icon_swordblood", "hammer-heavy": "icon_hammerheavy",
    # Una pieza distinta por tipo de arma, escudo y armadura: un florete no se ve como un mandoble.
    "sword-short": "icon_sword", "sword-long": "icon_sword2", "sword-rapier": "icon_sword2better",
    "axe-d": "icon_axe", "bow-long": "icon_bow", "shield-round": "icon_shield", "shield-spiked": "icon_shield2",
    "shield-heraldic": "icon_shield3", "armor-heavy": "icon_armor", "armor-silver": "icon_armorsilver",
    "helmet": "icon_helmet", "helmet-leather": "icon_helmetleather",
}
# --- Painterly Spell Icons, J. W. Bjerk (CC-BY 3.0): un color por motivo. ---
PAINT = {
    "spell-fire": "fireball-red-1", "spell-ice": "ice-blue-1", "spell-lightning": "lightning-blue-1",
    "spell-heal": "heal-jade-1", "spell-protect": "protect-blue-1", "spell-enchant": "enchant-royal-1",
    "spell-eye": "evil-eye-red-1", "spell-necrotic": "horror-eerie-1", "spell-wind": "wind-blue-1",
    "spell-earth": "rock-orange-1", "spell-plant": "vines-jade-1", "spell-haste": "haste-sky-1",
    "spell-force": "beam-blue-1", "spell-explosion": "explosion-orange-1", "spell-rune": "runes-magenta-1",
    "spell-wild": "wild-jade-1",
}
# --- game-icons.net (CC-BY 3.0): siluetas para lo que el resto no cubre. Se guardan como trazos SVG. ---
SIL = {
    "spear": "lorc/spears", "whip": "lorc/whip", "tools": "delapouite/toolbox", "rope": "delapouite/rope-coil",
    "lantern": "lorc/lantern", "instrument": "delapouite/harp", "drum": "delapouite/drum", "horn": "delapouite/bagpipes",
    "mount": "delapouite/horse-head", "saddle": "delapouite/saddle", "ship": "delapouite/sailboat", "wagon": "delapouite/old-wagon",
    "cards": "delapouite/card-joker", "dice": "delapouite/dice-six-faces-five", "explosive": "delapouite/dynamite",
    "club": "delapouite/wood-club", "halberd": "lorc/halberd", "trident": "lorc/trident", "flail": "delapouite/flail",
    "sling": "delapouite/slingshot", "boomerang": "delapouite/boomerang", "scythe": "lorc/scythe",
    "magic-item": "delapouite/sparkles", "orb": "lorc/crystal-ball", "camp": "delapouite/camping-tent", "campfire": "lorc/campfire",
    "hourglass": "lorc/hourglass", "backpack": "delapouite/backpack", "quill": "lorc/quill-ink", "mortar": "delapouite/mortar",
    "crown": "lorc/crown", "cape": "delapouite/cape", "money": "delapouite/money-stack", "lockpicks": "delapouite/lockpicks",
    "spyglass": "lorc/spyglass", "bell": "lorc/ringing-bell", "banner": "delapouite/knight-banner", "paw": "lorc/paw-front",
    "water": "sbed/water-drop", "light": "lorc/sun-radiations", "trap": "lorc/mantrap",
    "school-abjuration": "lorc/magic-shield", "school-conjuration": "lorc/magic-portal", "school-divination": "lorc/third-eye",
    "school-enchantment": "lorc/charm", "school-evocation": "lorc/explosion-rays", "school-illusion": "lorc/drama-masks",
    "school-necromancy": "lorc/dread-skull", "school-transmutation": "lorc/cycle",
    "kind-feat": "delapouite/star-medal", "kind-species": "delapouite/family-tree", "kind-background": "lorc/scroll-unfurled",
    "kind-subclass": "lorc/crossed-swords", "kind-feature": "lorc/rune-stone",
}

CREDITS = """Íconos de la Forja
==================

Pintados (hoja de sprites atlas.webp)
- RPG Icons Set. Dominio público (CC0). https://opengameart.org/content/rpg-icons-set
- Fantasy RPG Icons 1, 2 y 3, Drummyfish. Dominio público (CC0).
  https://opengameart.org/content/fantasy-rpg-icons-0
- Painterly Spell Icons 1-3, J. W. Bjerk (eleazzaar), https://opengameart.org/content/painterly-spell-icons-part-1
  Licencia CC BY 3.0 https://creativecommons.org/licenses/by/3.0/ . Se recortaron y
  se escalaron; no se modificó su dibujo.

Siluetas (trazos en packages/forge/src/icon-atlas.ts)
- game-icons.net, CC BY 3.0 https://creativecommons.org/licenses/by/3.0/ . Autores de cada
  ícono: {authors}
"""


def fetch(url: str, cache: Path) -> bytes:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / re.sub(r"[^A-Za-z0-9._-]", "_", url)
    if not f.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "forja-icon-atlas"})
        f.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return f.read_bytes()


def contain(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    scale = CELL / max(im.size)
    return im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(ROOT / ".cache" / "icon-atlas"))
    cache = Path(ap.parse_args().cache)

    atlas_png = Image.open(io.BytesIO(fetch(OGA + "rpg_icons_set.png", cache))).convert("RGBA")
    drum = {}
    for z in ("fantasy_rpg_icons.zip", "fantasy_rpg_icons_2.zip"):
        zf = zipfile.ZipFile(io.BytesIO(fetch(OGA + z, cache)))
        for n in zf.namelist():
            if n.lower().endswith(".png") and not Path(n).name.startswith("._"):
                drum[Path(n).stem] = zf.read(n)
    # El tercer volumen no viene en zip: archivos sueltos.
    for stem in ("icon_armorsilver", "icon_bow", "icon_charge", "icon_leaf", "icon_potioncolorful", "icon_rock",
                 "icon_shield3", "icon_skull", "icon_spellcastblue", "icon_sword2better", "icon_trousers", "icon_venom"):
        drum.setdefault(stem, fetch(OGA + stem + ".png", cache))
    paint = {}
    for n in (1, 2, 3):
        zf = zipfile.ZipFile(io.BytesIO(fetch(f"{OGA}painterly-spell-icons-{n}.zip", cache)))
        for name in zf.namelist():
            if name.lower().endswith(".png") and not Path(name).name.startswith("._"):
                paint[Path(name).stem] = zf.read(name)

    cells: list[tuple[str, Image.Image]] = []
    for key, idx in RPG.items():
        r, c = divmod(idx, 16)
        cells.append((key, atlas_png.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64)).resize((CELL, CELL), Image.LANCZOS)))
    for key, stem in DRUM.items():
        cells.append((key, contain(Image.open(io.BytesIO(drum[stem])))))
    for key, stem in PAINT.items():
        cells.append((key, contain(Image.open(io.BytesIO(paint[stem])))))

    rows = (len(cells) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    for i, (_, im) in enumerate(cells):
        r, c = divmod(i, COLS)
        sheet.alpha_composite(im, (c * CELL + (CELL - im.width) // 2, r * CELL + (CELL - im.height) // 2))
    out = ROOT / "apps/web/public/icons"
    out.mkdir(parents=True, exist_ok=True)
    sheet.save(out / "atlas.webp", "WEBP", quality=90, method=6)

    sil: dict[str, str] = {}
    authors: set[str] = set()
    for key, path in SIL.items():
        svg = fetch(GI + path + ".svg", cache).decode("utf-8")
        d = re.findall(r'<path[^>]*\sd="([^"]+)"', svg)
        d = [x for x in d if not re.fullmatch(r"M0 0h512v512H0z", x.strip())]
        sil[key] = "".join(d)
        authors.add(path.split("/")[0])

    keys = [k for k, _ in cells]
    ts = (
        "/**\n * Generado por tools/icon-atlas/build.py; no editar a mano.\n"
        " * Créditos en apps/web/public/icons/CREDITS.txt.\n */\n"
        f"export const ICON_CELL = {CELL};\nexport const ICON_COLS = {COLS};\n"
        f"export const ICON_SHEET_KEYS = {json.dumps(keys)} as const;\n"
        "export type SheetIconKey = (typeof ICON_SHEET_KEYS)[number];\n"
        "/** Siluetas de game-icons.net, viewBox 512x512, un solo color. */\n"
        f"export const ICON_SILHOUETTES = {json.dumps(sil, ensure_ascii=False)} as const;\n"
        "export type SilhouetteIconKey = keyof typeof ICON_SILHOUETTES;\n"
    )
    (ROOT / "packages/forge/src/icon-atlas.ts").write_text(ts, encoding="utf-8")
    (out / "CREDITS.txt").write_text(CREDITS.format(authors=", ".join(sorted(authors))), encoding="utf-8")
    print(f"{len(cells)} íconos pintados en {sheet.size}, {len(sil)} siluetas")


if __name__ == "__main__":
    sys.exit(main())

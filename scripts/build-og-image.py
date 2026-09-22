"""Genera apps/web/public/og.png y apple-touch-icon.png.

En Python y no en un `.mjs` como el resto de `scripts/` por una razón concreta:
rasterizar necesita un renderizador, y este monorepo no tiene ninguno — vitest
no dibuja, no hay Playwright ni sharp en el árbol de dependencias. Pillow ya
está en la máquina, así que agregarlo acá no suma nada al gate de pnpm. No corre
en el build: se ejecuta a mano cuando cambia la marca, y los PNG se commitean.

    python scripts/build-og-image.py
"""

import pathlib
import urllib.request

from PIL import Image, ImageDraw, ImageFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PUBLICO = RAIZ / "apps" / "web" / "public"
CACHE = pathlib.Path(__file__).resolve().parent / ".fuentes-og"

# apps/web/src/styles/base.css
VOID = "#030202"
PERGAMINO = "#E6DFCE"
CARMESI = "#6E0F0F"
ORO = "#B08A3E"
HIERRO = "#3A332A"

FUENTES = {
    "cinzel": "https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-jHgTYo.ttf",
    "garamond": "https://fonts.gstatic.com/s/ebgaramond/v33/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-6_RUAw.ttf",
}


def fuente(nombre, tam):
    CACHE.mkdir(parents=True, exist_ok=True)
    ruta = CACHE / f"{nombre}.ttf"
    if not ruta.exists():
        pedido = urllib.request.Request(FUENTES[nombre], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(pedido, timeout=30) as r:
            ruta.write_bytes(r.read())
    return ImageFont.truetype(str(ruta), tam)


def marca(d, x, y, lado):
    """El mismo faro que apps/web/public/favicon.svg, en viewBox 32."""
    s = lado / 32
    d.polygon([(x + 16 * s, y + 6 * s), (x + 25 * s, y + 26 * s), (x + 7 * s, y + 26 * s)], fill=CARMESI)
    d.polygon(
        [(x + 16 * s, y + 11 * s), (x + 21.5 * s, y + 23.5 * s), (x + 10.5 * s, y + 23.5 * s)],
        fill=VOID,
    )
    r = 3.4 * s
    d.ellipse([x + 16 * s - r, y + 9.5 * s - r, x + 16 * s + r, y + 9.5 * s + r], fill=ORO)


def og():
    im = Image.new("RGB", (1200, 630), VOID)
    d = ImageDraw.Draw(im)
    marca(d, 92, 84, 132)
    d.text((96, 268), "Faro del Alba", font=fuente("cinzel", 84), fill=PERGAMINO, anchor="lt")
    d.text(
        (96, 392),
        "Personajes de D&D 5e, con las reglas verificadas.",
        font=fuente("garamond", 40),
        fill=ORO,
        anchor="lt",
    )
    d.text(
        (96, 452),
        "Armá la ficha, mantenela, y llevala a Foundry VTT sin cargar nada a mano.",
        font=fuente("garamond", 31),
        fill="#9C9384",
        anchor="lt",
    )
    d.line([(96, 528), (1104, 528)], fill=HIERRO, width=2)
    d.text((96, 554), "alba.bertinilabs.xyz", font=fuente("garamond", 28), fill="#9C9384", anchor="lt")
    im.save(PUBLICO / "og.png", optimize=True)


def touch_icon():
    im = Image.new("RGB", (180, 180), VOID)
    marca(ImageDraw.Draw(im), 0, 0, 180)
    im.save(PUBLICO / "apple-touch-icon.png", optimize=True)


if __name__ == "__main__":
    og()
    touch_icon()
    print("apps/web/public/og.png y apple-touch-icon.png regenerados")

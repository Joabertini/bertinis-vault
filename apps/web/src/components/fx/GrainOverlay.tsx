import { useEffect, useState } from "react";

/**
 * Film grain and vignette.
 *
 * The grain used to be an SVG turbulence filter, drawn full-screen with
 * `mix-blend-overlay` and shaken four times a second. A blend mode makes the
 * browser re-composite everything under the layer on every frame, which is the
 * most expensive thing a page can ask of a graphics card for the least visible
 * result. Now the noise is drawn once into a small tile, painted as a plain
 * translucent image, and left still.
 */

const TILE = 160;

function noiseTile(): string {
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const image = ctx.createImageData(TILE, TILE);
  // White specks on nothing: a quarter of the pixels carry a random amount of
  // white and the rest stay clear, so the ground stays black. Opaque grey noise
  // would lift the whole page off black.
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 255;
    image.data[i + 1] = 255;
    image.data[i + 2] = 255;
    image.data[i + 3] = Math.random() < 0.25 ? Math.random() * 255 : 0;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png") || "";
}

export default function GrainOverlay() {
  const [tile, setTile] = useState("");
  useEffect(() => setTile(noiseTile()), []);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.07]"
        style={tile ? { backgroundImage: `url(${tile})`, backgroundSize: `${TILE}px ${TILE}px` } : undefined}
      />
      {/* vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[59]"
        style={{
          background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </>
  );
}

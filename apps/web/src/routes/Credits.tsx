import { Link } from "react-router-dom";

/**
 * Who drew what. The licences ask for it, and the people deserve it.
 *
 * The same text ships as `public/icons/CREDITS.txt`, which `tools/icon-atlas`
 * rewrites; keep the two in step.
 */
const PAINTED = [
  {
    name: "RPG Icons Set",
    by: "OpenGameArt",
    license: "CC0 (dominio público)",
    url: "https://opengameart.org/content/rpg-icons-set",
  },
  {
    name: "Fantasy RPG Icons 1, 2 y 3",
    by: "Drummyfish",
    license: "CC0 (dominio público)",
    url: "https://opengameart.org/content/fantasy-rpg-icons-0",
  },
  {
    name: "Painterly Spell Icons 1-3",
    by: "J. W. Bjerk (eleazzaar)",
    license: "CC BY 3.0",
    url: "https://opengameart.org/content/painterly-spell-icons-part-1",
  },
];

export default function Credits() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-bone">
      <Link to="/" className="font-mono text-[13px] uppercase tracking-[0.1em] text-gold">
        ← Volver
      </Link>
      <h1 className="mt-8 font-display text-3xl font-bold text-white">Créditos</h1>
      <p className="mt-4 font-body text-[17px] leading-relaxed">
        Los íconos de objetos, conjuros y demás entradas son de otras manos. Se recortaron y se
        escalaron; ninguno se redibujó.
      </p>

      <h2 className="mt-12 font-mono text-[13px] uppercase tracking-[0.1em] text-gold">Pintados</h2>
      <ul className="mt-4 space-y-4">
        {PAINTED.map((pack) => (
          <li key={pack.name} className="border-l-2 border-iron/60 pl-4">
            <a href={pack.url} target="_blank" rel="noreferrer" className="font-body text-[17px] text-white underline">
              {pack.name}
            </a>
            <p className="font-body text-[15px]">
              {pack.by} · {pack.license}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 font-mono text-[13px] uppercase tracking-[0.1em] text-gold">Siluetas</h2>
      <p className="mt-4 font-body text-[17px] leading-relaxed">
        <a href="https://game-icons.net" target="_blank" rel="noreferrer" className="text-white underline">
          game-icons.net
        </a>
        , de los autores Lorc, Delapouite y sbed, bajo{" "}
        <a
          href="https://creativecommons.org/licenses/by/3.0/"
          target="_blank"
          rel="noreferrer"
          className="text-white underline"
        >
          CC BY 3.0
        </a>
        . Son también los sigilos de las portadas.
      </p>
    </main>
  );
}

/**
 * The equipment the book hands over, as something to answer.
 *
 * This chamber used to print the kit and leave the player to find each piece in
 * a bag of 2658 items. A greataxe the book already gave you is not a search
 * result; it is yours.
 *
 * Granted rows are stated, not offered — nobody needs a button to accept the
 * explorer's pack. Lettered rows are the real questions and each shows what it
 * is worth, coins included: choosing between a greataxe and 75 gold with the
 * gold hidden is choosing blind.
 */

import { motion } from "framer-motion";

import { coinLabel, type KitRow } from "@/lib/starting-kit";
import { LABEL_MB2, WHISPER } from "@/styles/recipes";

export default function StartingKit({
  rows,
  choices,
  accent,
  onAnswer,
}: {
  rows: KitRow[];
  /** Row key to the option letter taken, for the rows that ask. */
  choices: Record<string, string>;
  accent: string;
  onAnswer: (rowKey: string, optionKey: string) => void;
}) {
  if (rows.length === 0) return null;

  const granted = rows.filter((row) => row.granted);
  const asked = rows.filter((row) => !row.granted);

  return (
    <div className="space-y-8">
      {granted.length > 0 && (
        <div>
          <p className={LABEL_MB2}>Te lo dan</p>
          <ul className="space-y-1.5">
            {granted.flatMap((row) =>
              row.options.map((option) => (
                <li
                  key={`${row.key}:${option.key}`}
                  className="font-body text-sm leading-relaxed text-bone/60"
                >
                  {option.label}
                </li>
              )),
            )}
          </ul>
        </div>
      )}

      {asked.map((row) => {
        const answer = choices[row.key];

        return (
          <div key={row.key}>
            <p className={LABEL_MB2}>
              {row.source === "class" ? "Elegis" : "Tu trasfondo te deja elegir"}
            </p>

            <div className="flex flex-col gap-2">
              {row.options.map((option) => {
                const taken = answer === option.key;
                const coins = coinLabel(option.copper);

                return (
                  <motion.button
                    key={option.key}
                    type="button"
                    onClick={() => onAnswer(row.key, option.key)}
                    {...(taken ? {} : { whileTap: { scale: 0.98 } })}
                    className="border px-4 py-3 text-left transition-colors"
                    style={{
                      borderColor: taken ? accent : "rgba(74,70,64,0.5)",
                      background: taken ? `${accent}12` : "transparent",
                    }}
                  >
                    <span
                      className="font-body text-sm leading-relaxed"
                      style={{ color: taken ? accent : "#E6DFCEaa" }}
                    >
                      {option.label}
                    </span>

                    {/* An option that still owes a pick says so before it is
                        taken, not after. */}
                    {option.openPicks.length > 0 && (
                      <span className={`mt-1 block ${WHISPER}`}>
                        elegis {option.openPicks.map((pick) => pick.label).join(" y ")} abajo
                      </span>
                    )}

                    {coins && (
                      <span className="mt-1 block font-mono text-[10px] tracking-[0.2em] text-gold/70">
                        {coins}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className={WHISPER}>
        Lo elegido entra a tu mochila. Sacalo de ahi si tu mesa te da otra cosa.
      </p>
    </div>
  );
}

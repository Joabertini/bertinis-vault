/**
 * "Recordatorios": what this character can do on their turn.
 *
 * Drawn from the sheet's own data (see `lib/turno.ts`), over the character's banner. Tapping an
 * option rolls it into the dice tray; the pips are the same play state the sheet keeps, so a
 * spent slot or Rage is spent in both. The page itself is `TurnoView`.
 */

import { useEffect, useMemo, useState } from "react";

import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { loadHojaRules } from "@/components/sheet/Hoja2024";
import TurnoView from "@/components/codex/TurnoView";
import type { BuilderState } from "@/lib/builder-state";
import { hojaDataFor, type HojaEstado, type HojaRules } from "@/lib/hoja-2024";
import { afterRest, turnoFor, withUsed, type Turno as TurnoData } from "@/lib/turno";

/** The level tables of every class, fetched once: how many Rages, how much Rage Damage. */
let classTable: Promise<NonNullable<HojaRules["classTable"]>> | null = null;
function loadClassTable() {
  classTable ??= fetch("/rules/classTable.json")
    .then((response) => (response.ok ? (response.json() as Promise<NonNullable<HojaRules["classTable"]>>) : {}))
    .catch(() => {
      classTable = null;
      return {};
    });
  return classTable;
}

export default function Turno({
  state,
  build,
  rulesVersion,
  onPatch,
}: {
  state: BuilderState;
  build: CharacterBuild;
  rulesVersion: RulesVersion;
  onPatch: (patch: Partial<BuilderState>) => void;
}) {
  const [rules, setRules] = useState<HojaRules | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([loadHojaRules(), loadClassTable()]).then(([loaded, table]) => live && setRules({ ...loaded, classTable: table }));
    return () => {
      live = false;
    };
  }, []);

  const played = (state.hoja ?? {}) as HojaEstado;
  // What changes the sheet's numbers: not the play state, which changes on every tap.
  const characterKey = JSON.stringify({ ...state, hoja: { quitados: played.quitados, hpMax: played.hpMax } });
  const data = useMemo(
    () => (rules ? hojaDataFor(state, build, rulesVersion, rules) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [characterKey, rulesVersion, rules],
  );
  const turno: TurnoData | null = useMemo(
    () => (data && rules ? turnoFor(data, rules, rulesVersion, played) : null),
    [data, rules, rulesVersion, played],
  );

  if (!turno || !data) {
    return <p className="px-8 py-10 font-body text-[15px] text-bone">Cargando el turno…</p>;
  }

  const save = (next: HojaEstado) => onPatch({ hoja: next as Record<string, unknown> });
  const hpMax = played.hpMax ?? data.hitPoints;

  return (
    <TurnoView
      turno={turno}
      onSet={(resource, used) => save(withUsed(played, resource, used))}
      onRest={(kind) => save(afterRest(played, turno, kind, hpMax))}
    />
  );
}

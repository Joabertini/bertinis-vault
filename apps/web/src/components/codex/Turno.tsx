/**
 * "Recordatorios": what this character can do on their turn.
 *
 * Drawn from the sheet's own data (see `lib/turno.ts`), over the character's banner. Tapping an
 * option rolls it into the dice tray; the pips are the same play state the sheet keeps, so a
 * spent slot or Rage is spent in both.
 */

import { useEffect, useMemo, useState } from "react";

import type { CharacterBuild } from "@bertinis-vault/contracts";
import type { RulesVersion } from "@bertinis-vault/vetools-ref";

import { loadHojaRules } from "@/components/sheet/Hoja2024";
import GameIcon from "@/components/icons/GameIcon";
import type { BuilderState } from "@/lib/builder-state";
import { hojaDataFor, type HojaEstado, type HojaRules } from "@/lib/hoja-2024";
import { rollFormula } from "@/lib/roll-formula";
import { useRolls } from "@/lib/roll-store";
import { afterRest, turnoFor, withUsed, type Role, type Turno, type TurnoOption, type TurnoResource, type TurnoRoll } from "@/lib/turno";

import "@/styles/turno.css";

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

const COLOR: Record<Role, string> = {
  dmg: "var(--tn-dmg)",
  ctl: "var(--tn-ctl)",
  heal: "var(--tn-heal)",
  def: "var(--tn-def)",
  mov: "var(--tn-mov)",
  util: "var(--tn-util)",
  rxn: "var(--tn-rxn)",
};

/** Rolls `roll` into the tray. A natural 20 on an attack says so. */
function throwInto(title: string, roll: TurnoRoll) {
  const result = rollFormula(roll.formula, "normal");
  const push = useRolls.getState().push;
  push({
    titulo: title,
    formula: roll.formula,
    total: result.total,
    detalle: result.detalle,
    modo: "normal",
    d20: result.d20,
    aviso: null,
  });
  if (result.d20 === 20 && /^Ataque/.test(roll.label)) {
    push({ titulo: "¡Crítico!", formula: "", total: null, detalle: "", modo: "normal", d20: null, aviso: "20 natural: tirá el daño con el botón Crítico del arma o conjuro.", critico: true });
  }
}

function Option({ option }: { option: TurnoOption }) {
  const style = { "--c": COLOR[option.role] } as React.CSSProperties;
  const first = option.attack ?? option.damage;
  const body = (
    <>
      <span className="ic" style={{ color: COLOR[option.role] }}>
        <GameIcon icon={option.icon} size={22} />
      </span>
      <span className="tx">
        <b>{option.name}</b>
        <span>{option.line}</span>
      </span>
    </>
  );
  const number = (
    <>
      <b>{option.big}</b>
      <span>{option.small}</span>
    </>
  );

  return (
    <div className="tn-opt" style={style}>
      {first ? (
        <button type="button" className="main" title={option.attack ? "Tirar el ataque" : "Tirar el daño"} onClick={() => throwInto(`${option.name} · ${first.label}`, first)}>
          {body}
        </button>
      ) : (
        <div className="main">{body}</div>
      )}
      {option.damage && option.attack ? (
        <button type="button" className="nu" title="Tirar el daño" onClick={() => throwInto(`${option.name} · Daño`, option.damage!)}>
          {number}
        </button>
      ) : (
        <div className="nu">{number}</div>
      )}
    </div>
  );
}

function Pips({ resource, onSet }: { resource: TurnoResource; onSet: (used: number) => void }) {
  const available = resource.max - resource.used;
  return (
    <div className="tn-pips" role="group" aria-label={resource.name}>
      {Array.from({ length: resource.max }, (_, index) => (
        <button
          key={index}
          type="button"
          className={`tn-pip${index < available ? "" : " off"}`}
          aria-pressed={index < available}
          aria-label={`${resource.name} ${index + 1}`}
          // Pressing a full pip spends from it up; pressing an empty one restores down to it.
          onClick={() => onSet(resource.max - (available > index ? index : index + 1))}
        />
      ))}
    </div>
  );
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
  const turno: Turno | null = useMemo(
    () => (data && rules ? turnoFor(data, rules, rulesVersion, played) : null),
    [data, rules, rulesVersion, played],
  );

  if (!turno || !data) {
    return <p className="px-8 py-10 font-body text-[15px] text-bone">Cargando el turno…</p>;
  }

  const save = (next: HojaEstado) => onPatch({ hoja: next as Record<string, unknown> });
  const hpMax = played.hpMax ?? data.hitPoints;

  return (
    <div className="tn">
      <div className="tn-banner" style={{ backgroundImage: `url("${turno.banner}")` }} />
      <div className="tn-body">
        <header className="tn-head">
          <div>
            <div className="tn-name">{turno.name}</div>
            <div className="tn-sub">{turno.line}</div>
          </div>
          <div className="tn-vit">
            {turno.vitals.map(([label, value]) => (
              <div key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="tn-hp">
          <span>PV</span>
          <div className="bar">
            <i style={{ width: `${Math.max(0, Math.min(100, (turno.hp.value / Math.max(1, turno.hp.max)) * 100))}%` }} />
          </div>
          <b>
            {turno.hp.value} / {turno.hp.max}
          </b>
        </div>

        {turno.tips.length > 0 && (
          <div className="tn-tip">
            <div>
              <p>{turno.tips[0]}</p>
              {turno.tips[1] && <small>{turno.tips[1]}</small>}
            </div>
          </div>
        )}

        <div className="tn-lbl">Tu turno</div>
        <div className="tn-turn">
          {turno.slots.map((slot) => (
            <section key={slot.id}>
              <div className="tn-sh">
                <b>{slot.title}</b>
                <span>{slot.hint}</span>
              </div>
              {slot.options.map((option) => (
                <Option key={option.id} option={option} />
              ))}
            </section>
          ))}
        </div>

        <div className="tn-low">
          <div>
            <div className="tn-lbl">Reacciones</div>
            {turno.reactions.length === 0 && <p className="tn-sub">No tenés reacciones preparadas.</p>}
            {turno.reactions.map((reaction) => (
              <div key={reaction.id} className="tn-rx">
                <div className="w">{reaction.when}</div>
                <div style={{ color: COLOR[reaction.role] }}>→</div>
                {reaction.roll ? (
                  <button type="button" className="t" title="Tirar el ataque" onClick={() => throwInto(`${reaction.name}`, reaction.roll!)}>
                    {reaction.name}
                    <small>{reaction.line}</small>
                  </button>
                ) : (
                  <div className="t">
                    {reaction.name}
                    <small>{reaction.line}</small>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div>
            <div className="tn-lbl">Recursos</div>
            <div className="tn-res">
              {turno.resources.map((resource) => (
                <div key={resource.id} className="tn-rs" style={{ "--c": COLOR[resource.role] } as React.CSSProperties}>
                  <div>
                    <b>{resource.name}</b>
                    <small>{resource.hint}</small>
                  </div>
                  <Pips resource={resource} onSet={(used) => save(withUsed(played, resource, used))} />
                </div>
              ))}
            </div>
            <div className="tn-rest">
              <button type="button" onClick={() => save(afterRest(played, turno, "corto", hpMax))}>
                Descanso corto
              </button>
              <button type="button" onClick={() => save(afterRest(played, turno, "largo", hpMax))}>
                Descanso largo
              </button>
            </div>
          </div>
        </div>

        {turno.feature && (
          <>
            <div className="tn-lbl">Rasgo útil</div>
            <div className="tn-tip">
              <p>
                <strong>{turno.feature.name}.</strong> {turno.feature.text}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

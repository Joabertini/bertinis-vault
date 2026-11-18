/**
 * "Tu turno", drawn. No data loading here: `Turno` brings the character and the rules; this is
 * the page, so a screenshot probe can draw it without a browser fetching anything.
 */

import GameIcon from "@/components/icons/GameIcon";
import { rollFormula } from "@/lib/roll-formula";
import { useRolls } from "@/lib/roll-store";
import type { Role, Turno, TurnoOption, TurnoResource, TurnoRoll } from "@/lib/turno";

import "@/styles/turno.css";

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

export default function TurnoView({
  turno,
  onSet,
  onRest,
}: {
  turno: Turno;
  onSet: (resource: TurnoResource, used: number) => void;
  onRest: (kind: "corto" | "largo") => void;
}) {
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
                  <button type="button" className="t" title="Tirar el ataque" onClick={() => throwInto(reaction.name, reaction.roll!)}>
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
                  <Pips resource={resource} onSet={(used) => onSet(resource, used)} />
                </div>
              ))}
            </div>
            <div className="tn-rest">
              <button type="button" onClick={() => onRest("corto")}>
                Descanso corto
              </button>
              <button type="button" onClick={() => onRest("largo")}>
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

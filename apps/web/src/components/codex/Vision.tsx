/**
 * La cheatsheet, con el diseño de `Joabertini/dnd-cheatsheet`.
 *
 * Este archivo es una reproducción de esa hoja, no una interpretación suya: la
 * tipografía Georgia, el fondo teñido por la clase, la fila de píldoras, las
 * tres pestañas con la línea del color de la clase, las secciones con cabecera
 * tintada, las tarjetas con píldora de recurso y el pie. Los valores —cada
 * padding, cada opacidad en hexadecimal, cada tamaño de letra— están copiados
 * del original y no reelegidos. El diseño ya se probó contra jugadores; el que
 * había acá no.
 *
 * Los estilos van **en línea**, como en el original, y no en clases del Vault.
 * Es a propósito: la hoja se construye componiendo un color de clase con una
 * opacidad (`${color}30`), que es algo que un tema de utilidades no expresa, y
 * mantenerlo así deja la comparación contra el original directa.
 *
 * **Tres cosas del original no se reproducen, porque el tomo ya las contesta.**
 * Allá la fila de doce clases y la de subclases son un selector, el nivel es un
 * campo editable y hay un recuadro para arrastrar la hoja: son las preguntas
 * que un personaje sellado ya respondió. Quedan las píldoras de su clase y su
 * subclase, con el mismo estilo, como lo que son acá — una etiqueta.
 *
 * Y una que el original no tenía: los números. La cheatsheet se escribió para
 * imprimirse una vez y leerse en cualquier mesa, así que no podía cargar el
 * ataque, la CA ni los PG. Un tomo es de un personaje y sí puede.
 */

import { useState } from "react";

import type { ComboNote, FeatNote, PlayNote, Playbook } from "@/lib/playbook";
import { paletteFor, type ClassPalette } from "@/lib/playbook-palette";

/** Las tres pestañas del original, en su orden y con sus iconos. */
const TABS = [
  { id: "combat", label: "⚔️ Combate" },
  { id: "features", label: "✨ Features" },
  { id: "rules", label: "📖 Reglas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Una sección con cabecera teñida.
 *
 * El borde y el fondo de la cabecera salen del `color` de la clase; el texto,
 * del `accent`. Sobre negro el `color` no se lee, y por eso son dos tonos y no
 * uno.
 */
function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: ClassPalette;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `1px solid ${palette.color}30`,
        borderRadius: 6,
        overflow: "hidden",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "6px 12px",
          background: `${palette.color}20`,
          borderBottom: `1px solid ${palette.color}30`,
          fontSize: 11,
          fontWeight: "bold",
          letterSpacing: "0.08em",
          color: palette.accent,
        }}
      >
        {title}
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

/** Una acción adicional o una reacción. La más chica de las tres tarjetas. */
function ActionCard({ note, palette }: { note: PlayNote; palette: ClassPalette }) {
  return (
    <div
      style={{
        padding: "7px 10px",
        background: note.highlight ? `${palette.color}18` : "#ffffff06",
        border: `1px solid ${note.highlight ? `${palette.color}50` : "#ffffff15"}`,
        borderRadius: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span
          style={{ fontSize: 12, fontWeight: "bold", color: note.highlight ? palette.accent : "#ddd" }}
        >
          {note.name}
        </span>
        {note.resource && (
          <span
            style={{
              fontSize: 10,
              padding: "1px 6px",
              background: `${palette.color}25`,
              border: `1px solid ${palette.color}40`,
              borderRadius: 10,
              color: palette.accent,
            }}
          >
            {note.resource}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.4 }}>{note.desc}</div>
    </div>
  );
}

/** Un rasgo de clase o de subclase. La píldora de recurso se va a la derecha. */
function FeatureCard({ note, palette }: { note: PlayNote; palette: ClassPalette }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: note.highlight ? `${palette.color}12` : "#ffffff05",
        border: `1px solid ${note.highlight ? `${palette.color}40` : "#ffffff10"}`,
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {note.highlight && <span style={{ color: palette.accent, fontSize: 14 }}>★</span>}
        <span
          style={{ fontSize: 14, fontWeight: "bold", color: note.highlight ? palette.accent : "#ddd" }}
        >
          {note.name}
        </span>
        {note.resource && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              padding: "2px 8px",
              background: `${palette.color}20`,
              border: `1px solid ${palette.color}40`,
              borderRadius: 10,
              color: palette.accent,
            }}
          >
            {note.resource}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.5 }}>{note.desc}</div>
    </div>
  );
}

/** Una dote. Va en dorado y no en el color de la clase, como en el original. */
function FeatCard({ name, note }: { name: string; note: FeatNote }) {
  const gold = "#c8a832";
  return (
    <div
      style={{
        padding: "8px 11px",
        background: note.highlight ? "#2a2000" : "#1a1800",
        border: `1px solid ${note.highlight ? `${gold}50` : `${gold}25`}`,
        borderRadius: 5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
        <span style={{ fontSize: 14 }}>{note.icon || "⚡"}</span>
        <span style={{ fontSize: 13, fontWeight: "bold", color: note.highlight ? gold : "#d4b84a" }}>
          {name}
        </span>
        {note.resource && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              padding: "1px 7px",
              background: `${gold}20`,
              border: `1px solid ${gold}40`,
              borderRadius: 10,
              color: "#d4b84a",
              flexShrink: 0,
            }}
          >
            {note.resource}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#bba", lineHeight: 1.4 }}>{note.desc}</div>
      {note.tip && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#8a7a40", fontStyle: "italic" }}>
          💡 {note.tip}
        </div>
      )}
    </div>
  );
}

/** Una combinación. Violeta fijo: no es de la clase, es de cómo se juegan dos. */
function ComboCard({ combo }: { combo: ComboNote }) {
  return (
    <div
      style={{
        padding: "11px 14px",
        background: combo.highlight ? "#150025" : "#0d0d1a",
        border: `1px solid ${combo.highlight ? "#8e44ad60" : "#44447060"}`,
        borderLeft: `3px solid ${combo.highlight ? "#8e44ad" : "#4444aa"}`,
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{combo.icon}</span>
        <span
          style={{ fontSize: 14, fontWeight: "bold", color: combo.highlight ? "#b060e8" : "#8888cc" }}
        >
          {combo.name}
        </span>
        {combo.highlight && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 7px",
              background: "#8e44ad30",
              border: "1px solid #8e44ad60",
              borderRadius: 10,
              color: "#b060e8",
              letterSpacing: "0.05em",
            }}
          >
            ⭐ CONOCIDO
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.5, marginBottom: 6 }}>{combo.what}</div>
      <div
        style={{
          padding: "6px 10px",
          background: "#ffffff08",
          borderRadius: 4,
          fontSize: 12,
          color: "#aaa",
          lineHeight: 1.4,
        }}
      >
        <span style={{ color: "#8888cc", fontWeight: "bold" }}>🎯 Cómo usarlo: </span>
        {combo.how}
      </div>
    </div>
  );
}

/** El aviso rojo de lo que la clase suele olvidarse. */
function Tip({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "9px 12px",
        marginBottom: 14,
        background: "#1a0f00",
        border: "1px solid #c0392b80",
        borderLeft: "3px solid #c0392b",
        borderRadius: 4,
        fontSize: 12,
        color: "#e88",
      }}
    >
      {text}
    </div>
  );
}

/** El encabezado de un grupo suelto: dorado para dotes, violeta para combos. */
function GroupTitle({ text, color }: { text: string; color: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: "bold",
        color,
        letterSpacing: "0.1em",
        marginBottom: 8,
        borderBottom: `1px solid ${color}40`,
        paddingBottom: 4,
      }}
    >
      {text}
    </div>
  );
}

export default function Vision({
  playbook,
  classId,
  className,
  subclassLabel,
  name,
  subtitle,
}: {
  playbook: Playbook;
  /** El id canónico, que es con lo que la cheatsheet elige el color. */
  classId: string;
  /** "Guerrero", ya traducido. */
  className: string;
  subclassLabel: string | null;
  name: string;
  /** "Nivel 5 · Humano · Guerrero", ya armado. */
  subtitle: string;
}) {
  const [tab, setTab] = useState<TabId>("combat");
  const palette = paletteFor(classId);

  if (playbook.unwritten) {
    return (
      <div
        style={{
          background: palette.bg,
          fontFamily: "Georgia, serif",
          color: "#e8e0d0",
          padding: "48px 20px",
          textAlign: "center",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        La cheatsheet no tiene nada escrito para esta clase todavía.
      </div>
    );
  }

  /** Una píldora del color de la clase. La fila de arriba del original. */
  const pill = (text: string, big: boolean) => (
    <span
      key={text}
      style={{
        padding: big ? "3px 9px" : "2px 8px",
        borderRadius: big ? 20 : 4,
        border: `1px solid ${palette.color}`,
        background: `${palette.color}${big ? "30" : "25"}`,
        color: palette.accent,
        fontSize: big ? 11 : 10,
      }}
    >
      {text}
    </span>
  );

  return (
    <div
      style={{
        background: palette.bg,
        fontFamily: "Georgia, serif",
        color: "#e8e0d0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ---- HEADER ---- */}
      <div
        style={{
          borderBottom: `2px solid ${palette.color}60`,
          background: `linear-gradient(180deg, ${palette.bg} 0%, transparent 100%)`,
          padding: "16px 20px 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div
            style={{
              fontSize: 28,
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `${palette.color}30`,
              borderRadius: 8,
              border: `1px solid ${palette.color}50`,
              flexShrink: 0,
            }}
          >
            {playbook.icon ?? "⚔️"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>{name}</div>
            <div style={{ fontSize: 12, color: palette.accent, marginTop: 2 }}>
              {subtitle}
              {playbook.role && ` — ${playbook.role}`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
          {pill(`${playbook.icon ?? ""} ${className}`.trim(), true)}
        </div>
        {subclassLabel && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {pill(subclassLabel, false)}
          </div>
        )}
      </div>

      {/* ---- los números, que el original no podía tener ---- */}
      {playbook.vitals.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            padding: "10px 16px 0",
          }}
        >
          {playbook.vitals.map((vital) => (
            <div
              key={vital.label}
              style={{
                padding: "5px 12px",
                border: `1px solid ${palette.color}30`,
                borderRadius: 6,
                background: "#ffffff06",
                minWidth: 78,
              }}
            >
              <div style={{ fontSize: 10, color: "#888", letterSpacing: "0.08em" }}>
                {vital.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: palette.accent }}>
                {vital.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- avisos de dificultad ---- */}
      {playbook.warnings.length > 0 && (
        <div
          style={{
            margin: "10px 16px 0",
            padding: "8px 12px",
            background: "#2d1500",
            border: "1px solid #e67e2260",
            borderRadius: 6,
          }}
        >
          {playbook.warnings.map((warning, i) => (
            <div
              key={warning}
              style={{
                fontSize: 11,
                color: "#f39c12",
                marginBottom: i < playbook.warnings.length - 1 ? 3 : 0,
              }}
            >
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* ---- TABS ---- */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid #333",
          margin: "10px 0 0",
          padding: "0 16px",
        }}
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            style={{
              padding: "7px 12px",
              fontSize: 12,
              fontFamily: "Georgia, serif",
              background: "transparent",
              border: "none",
              borderBottom: tab === entry.id ? `2px solid ${palette.color}` : "2px solid transparent",
              color: tab === entry.id ? palette.accent : "#777",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* ---- CONTENIDO ---- */}
      <div style={{ padding: "14px 16px", maxWidth: 900 }}>
        {tab === "combat" && (
          <div>
            {playbook.tips.map((tip) => (
              <Tip key={tip} text={tip} />
            ))}

            {playbook.combos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <GroupTitle
                  text={`🔗 COMBOS DETECTADOS (${playbook.combos.length})`}
                  color="#9b59b6"
                />
                {playbook.combos.map((combo) => (
                  <ComboCard key={combo.id} combo={combo} />
                ))}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Section title="⚡ ACCIONES ADICIONALES" palette={palette}>
                {playbook.bonusActions.length > 0 ? (
                  playbook.bonusActions.map((note) => (
                    <ActionCard key={note.name} note={note} palette={palette} />
                  ))
                ) : (
                  <p style={{ color: "#666", fontSize: 11, fontStyle: "italic", margin: 0 }}>
                    Sin acciones adicionales de clase.
                  </p>
                )}
              </Section>
              <Section title="🔄 REACCIONES" palette={palette}>
                {playbook.reactions.map((note) => (
                  <ActionCard key={note.name} note={note} palette={palette} />
                ))}
                <div
                  style={{
                    marginTop: 4,
                    padding: "5px 8px",
                    background: "#ffffff08",
                    borderRadius: 4,
                    fontSize: 10,
                    color: "#888",
                  }}
                >
                  + Siempre:{" "}
                  <span style={{ color: "#aaa" }}>
                    Ataque de oportunidad cuando enemigo sale de tu alcance sin Disengage
                  </span>
                </div>
              </Section>
            </div>

            {playbook.feats.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <GroupTitle text={`⚡ FEATS ACTIVAS (${playbook.feats.length})`} color="#c8a832" />
                <div style={{ display: "grid", gap: 6 }}>
                  {playbook.feats.map((entry) => (
                    <FeatCard key={entry.name} name={entry.name} note={entry.note} />
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 10,
                padding: "9px 12px",
                background: "#ffffff06",
                border: "1px solid #ffffff15",
                borderRadius: 6,
              }}
            >
              <div
                style={{ fontSize: 11, fontWeight: "bold", color: palette.accent, marginBottom: 5 }}
              >
                TU TURNO — economía de acción
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
                {[
                  { label: "MOVIMIENTO", color: "#3498db" },
                  { label: "ACCIÓN", color: "#e74c3c" },
                  { label: "ACCIÓN ADICIONAL", color: "#f39c12" },
                  { label: "INTERACCIÓN GRATIS", color: "#27ae60" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: `${item.color}20`,
                      border: `1px solid ${item.color}50`,
                      fontSize: 10,
                      color: item.color,
                    }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#666" }}>
                La REACCIÓN se usa fuera de tu turno (1 por ronda) · Bonus Action ≠ Action
              </div>
            </div>
          </div>
        )}

        {tab === "features" && (
          <div>
            {playbook.tips.map((tip) => (
              <Tip key={tip} text={tip} />
            ))}
            <div style={{ display: "grid", gap: 8 }}>
              {playbook.features.map((note) => (
                <FeatureCard key={note.name} note={note} palette={palette} />
              ))}
            </div>
            {playbook.feats.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <GroupTitle text="⚡ FEATS DE ESTE PERSONAJE" color="#c8a832" />
                <div style={{ display: "grid", gap: 6 }}>
                  {playbook.feats.map((entry) => (
                    <FeatCard key={entry.name} name={entry.name} note={entry.note} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "rules" && (
          <div style={{ display: "grid", gap: 10 }}>
            {playbook.rules.map((block) => (
              <Section key={block.title} title={block.title} palette={palette}>
                {block.items.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: "7px 10px",
                      background: "#ffffff06",
                      border: "1px solid #ffffff15",
                      borderRadius: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: "bold",
                        color: item.color ?? palette.accent,
                        marginBottom: 3,
                      }}
                    >
                      {item.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                ))}
              </Section>
            ))}
          </div>
        )}
      </div>

      {/* ---- PIE ---- */}
      <div
        style={{
          textAlign: "center",
          padding: 10,
          borderTop: "1px solid #222",
          fontSize: 10,
          color: "#444",
          marginTop: 8,
        }}
      >
        {`Bertini's · Cheat Sheet de ${name} · ${playbook.icon ?? ""} ${subtitle}`}
      </div>
    </div>
  );
}

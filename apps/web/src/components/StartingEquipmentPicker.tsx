import {
  averageStartingGold,
  coinsFromCopper,
  equipmentRowId,
  type ResolvedStartingEquipment,
  type StartingEquipmentEntry,
  type StartingEquipmentList,
} from "@bertinis-vault/domain";

type Props = {
  lists: StartingEquipmentList[];
  answers: Record<string, string>;
  resolved: ResolvedStartingEquipment;
  takeGold: boolean;
  onAnswer: (rowId: string, option: string) => void;
  onTakeGold: (take: boolean) => void;
};

/** One entry as a line a player can compare against the other option. */
function describeEntry(entry: StartingEquipmentEntry): string {
  switch (entry.kind) {
    case "item": {
      const name = entry.displayName ?? entry.name;
      return entry.quantity && entry.quantity > 1 ? `${entry.quantity}× ${name}` : name;
    }
    case "category": {
      const label = entry.categories.map(categoryLabel).join(" o ");
      return entry.quantity && entry.quantity > 1 ? `${entry.quantity}× ${label}` : label;
    }
    case "coins": {
      const { gp, sp, cp } = coinsFromCopper(entry.copper);
      return [gp ? `${gp} po` : "", sp ? `${sp} pp` : "", cp ? `${cp} pc` : ""]
        .filter(Boolean)
        .join(" ");
    }
    case "special":
      return entry.quantity && entry.quantity > 1
        ? `${entry.quantity}× ${entry.label}`
        : entry.label;
  }
}

/** The category names the data uses, which are not words a player reads. */
const CATEGORY_LABELS: Record<string, string> = {
  weaponSimple: "un arma simple",
  weaponSimpleMelee: "un arma simple cuerpo a cuerpo",
  weaponMartial: "un arma marcial",
  weaponMartialMelee: "un arma marcial cuerpo a cuerpo",
  instrumentMusical: "un instrumento musical",
  toolArtisan: "unas herramientas de artesano",
  focusSpellcastingArcane: "un focus arcano",
  focusSpellcastingDruidic: "un focus druidico",
  focusSpellcastingHoly: "un simbolo sagrado",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

const LIST_LABELS: Record<string, string> = {
  class: "Clase",
  background: "Trasfondo",
};

/**
 * The starting-equipment questions, as questions.
 *
 * The books write these as a sentence — "(a) a rapier or (b) a shortsword" —
 * and a sentence cannot be answered, which is why the builder used to grant a
 * fixed list and never ask. Each row here is one question; a row the data
 * grants outright is shown but has nothing to pick.
 *
 * The gold alternative is a 2014 rule and replaces every list at once, so it
 * sits above the rows rather than inside one. 2024 folded the money into the
 * options themselves, and there it appears as an ordinary answer.
 */
export function StartingEquipmentPicker({
  lists,
  answers,
  resolved,
  takeGold,
  onAnswer,
  onTakeGold,
}: Props) {
  if (lists.length === 0) return null;

  const formula = lists.find((list) => list.goldAlternative)?.goldAlternative ?? null;
  const average = formula ? averageStartingGold(formula) : null;
  const coins = coinsFromCopper(resolved.copper);

  return (
    <div className="field">
      <label>Equipo inicial</label>

      {formula ? (
        <label className={`opt${takeGold ? " selected" : ""}`}>
          <input checked={takeGold} onChange={(event) => onTakeGold(event.target.checked)} type="checkbox" />
          Tomar {formula} po en vez de todo el equipo
          {average === null ? "" : ` (promedio ${average} po)`}
        </label>
      ) : null}

      {takeGold ? (
        <div className="feat-info">
          El personaje empieza sin equipo y con <strong>{coins.gp} po</strong>. Las listas de clase y
          trasfondo quedan sin efecto: la regla reemplaza todo, no una fila.
        </div>
      ) : (
        lists.map((list) =>
          list.rows.map((row, index) => {
            const rowId = equipmentRowId(list.id, index);
            const where = LIST_LABELS[list.id] ?? list.id;

            if (row.fixed) {
              return (
                <div className="feat-info" key={rowId}>
                  {where}, otorgado:{" "}
                  <strong>
                    {(row.options[0]?.entries ?? []).map(describeEntry).join(", ")}
                  </strong>
                </div>
              );
            }

            return (
              <div className="options-grid" key={rowId}>
                {row.options.map((option) => (
                  <label
                    className={`opt${answers[rowId] === option.key ? " selected" : ""}`}
                    key={option.key}
                  >
                    <input
                      checked={answers[rowId] === option.key}
                      name={rowId}
                      onChange={() => onAnswer(rowId, option.key)}
                      type="radio"
                    />
                    ({option.key}) {option.entries.map(describeEntry).join(", ")}
                  </label>
                ))}
              </div>
            );
          }),
        )
      )}

      {!takeGold && resolved.unanswered.length > 0 ? (
        <div className="feat-info">
          Faltan <strong>{resolved.unanswered.length}</strong> elecciones de equipo. Lo que no se
          elige no se otorga.
        </div>
      ) : null}

      {!takeGold && resolved.openCategories.length > 0 ? (
        <div className="feat-info">
          A elegir aparte:{" "}
          <strong>
            {resolved.openCategories
              .map((open) =>
                open.quantity > 1
                  ? `${open.quantity}× ${open.categories.map(categoryLabel).join(" o ")}`
                  : open.categories.map(categoryLabel).join(" o "),
              )
              .join(", ")}
          </strong>
          . La lista nombra una categoria, no un objeto, asi que va en el equipo extra.
        </div>
      ) : null}

      {!takeGold && resolved.specials.length > 0 ? (
        <div className="feat-info">
          Sin entrada de objeto:{" "}
          <strong>
            {resolved.specials
              .map((entry) => (entry.quantity > 1 ? `${entry.quantity}× ${entry.label}` : entry.label))
              .join(", ")}
          </strong>
        </div>
      ) : null}

      {!takeGold && resolved.copper > 0 ? (
        <div className="feat-info">
          Dinero inicial: <strong>{coins.gp} po</strong>
          {coins.sp ? ` ${coins.sp} pp` : ""}
          {coins.cp ? ` ${coins.cp} pc` : ""}
        </div>
      ) : null}
    </div>
  );
}

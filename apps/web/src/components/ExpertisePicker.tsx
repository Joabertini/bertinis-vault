import { isExpertiseChoice, type ExpertiseAnswer, type ExpertiseGrantLike } from "@bertinis-vault/domain";

type Props = {
  grant: ExpertiseGrantLike;
  answer: ExpertiseAnswer | null;
  /** What the character is proficient in — the only things it can double. */
  proficientSkills: string[];
  proficientTools: string[];
  /** Already doubled by an earlier grant, so not on offer again. */
  alreadyExpert: string[];
  onChange: (answer: ExpertiseAnswer) => void;
};

/** How a set reads on one line, so the alternatives can be compared. */
function describe(set: ExpertiseGrantLike["sets"][number]): string {
  const parts: string[] = [];
  if (set.anySkill) parts.push(`${set.anySkill} skill${set.anySkill > 1 ? "s" : ""}`);
  if (set.anyTool) parts.push(`${set.anyTool} herramienta${set.anyTool > 1 ? "s" : ""}`);
  parts.push(...set.skills, ...set.tools);
  return parts.join(" + ");
}

/**
 * The proficiencies an expertise grant doubles.
 *
 * Renders nothing for a grant with nothing to decide — the scout's Survivalist
 * doubles Nature and Survival and there is no question in it. What is left is
 * the real choice: which set, and which of the character's own proficiencies
 * fill it. The pool is the character's, not the game's, because expertise
 * doubles a proficiency rather than granting one.
 */
export function ExpertisePicker({
  grant,
  answer,
  proficientSkills,
  proficientTools,
  alreadyExpert,
  onChange,
}: Props) {
  if (!isExpertiseChoice(grant)) return null;

  const setIndex = answer?.setIndex ?? 0;
  const set = grant.sets[setIndex] ?? grant.sets[0];
  if (!set) return null;

  const picked = answer ?? { setIndex, skills: [], tools: [] };

  const setSlot = (of: "skills" | "tools", slot: number, value: string) => {
    const next = [...picked[of]];
    if (value) next[slot] = value;
    else next.splice(slot, 1);
    onChange({ ...picked, setIndex, [of]: next.filter(Boolean) });
  };

  const slots = (of: "skills" | "tools", count: number, pool: string[]) =>
    Array.from({ length: count }, (_, slot) => {
      // A proficiency already doubled buys nothing a second time, and one
      // taken in another slot of the same grant cannot be taken twice either.
      const taken = new Set([...alreadyExpert, ...picked[of].filter((_, i) => i !== slot)]);
      const options = pool.filter((entry) => !taken.has(entry) || picked[of][slot] === entry);

      return (
        <select
          id={`expertise-${grant.name}-${of}-${slot}`}
          key={`${of}-${slot}`}
          onChange={(event) => setSlot(of, slot, event.target.value)}
          value={picked[of][slot] ?? ""}
        >
          <option value="">Elegir&hellip;</option>
          {options.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      );
    });

  return (
    <div className="field">
      <label>
        {grant.name} (nivel {grant.level})
      </label>

      {grant.sets.length > 1 ? (
        <select
          id={`expertise-${grant.name}-set`}
          onChange={(event) =>
            onChange({ setIndex: Number(event.target.value), skills: [], tools: [] })
          }
          value={setIndex}
        >
          {grant.sets.map((option, index) => (
            <option key={describe(option)} value={index}>
              {describe(option)}
            </option>
          ))}
        </select>
      ) : null}

      <div className="array-row">
        {slots("skills", set.anySkill, proficientSkills)}
        {slots("tools", set.anyTool, proficientTools)}
      </div>

      {set.skills.length || set.tools.length ? (
        <div className="feat-info">
          Ademas dobla: <strong>{[...set.skills, ...set.tools].join(", ")}</strong>
        </div>
      ) : null}
    </div>
  );
}

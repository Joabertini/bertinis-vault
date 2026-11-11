import DiceTray from "@/components/forge/DiceTray";
import PointBuy from "@/components/forge/PointBuy";
import StatRune from "@/components/forge/StatRune";
import type { AbilityId } from "@/lib/abilities";
import type { BuilderState } from "@/lib/builder-state";
import { STAT_METHODS, type StatMethodId } from "@/lib/stat-methods";
import type { ForgeScratch } from "@/lib/vault-store";
import { HEADING } from "@/styles/recipes";

/** How the six numbers get made: rolled, bought, from the array, or typed. */
export default function AttributesChamber({
  statMethod,
  abilityBonuses,
  rawScores,
  scratch,
  bound,
  accent,
  onChooseMethod,
  onScore,
  onRoll,
  onKeep,
  onBind,
  onRelease,
}: {
  statMethod: BuilderState["statMethod"];
  abilityBonuses: BuilderState["abilityBonuses"];
  rawScores: Record<AbilityId, number>;
  scratch: ForgeScratch;
  bound: Set<AbilityId>;
  accent: string;
  onChooseMethod: (method: StatMethodId) => void;
  onScore: (ability: AbilityId, score: number) => void;
  onRoll: (rolled: number[]) => void;
  onKeep: (index: number) => void;
  onBind: (ability: AbilityId, value: number) => void;
  onRelease: (ability: AbilityId) => void;
}) {
  return (
    <div className="space-y-10">
      {/* Which way the six numbers get made. All four already
          existed in the model and mapped to the payload; only
          rolling was ever wired to a screen. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_METHODS.map((method) => {
          const active = statMethod === method.id;
          return (
            <button
              key={method.id}
              onClick={() => onChooseMethod(method.id)}
              className="border p-4 text-left transition-colors"
              style={{
                borderColor: active ? `${accent}88` : "rgba(74,70,64,0.4)",
                background: active ? `${accent}0f` : "transparent",
              }}
            >
              <p
                className={HEADING}
                style={{ color: active ? accent : "#FFFFFF" }}
              >
                {method.label}
              </p>
              <p className="mt-1 font-body text-[15px] leading-snug text-bone">
                {method.blurb}
              </p>
            </button>
          );
        })}
      </div>

      {statMethod === "pointbuy" || statMethod === "manual" ? (
        <PointBuy
          mode={statMethod === "manual" ? "manual" : "pointbuy"}
          scores={rawScores}
          bonuses={abilityBonuses}
          accent={accent}
          onChange={onScore}
        />
      ) : (
        <>
          {/* Three throws, and the player keeps one. The sum of
              modifiers is shown because it is the one number that
              compares two spreads without reading six. */}
          {statMethod === "roll" && (
            <DiceTray
              onRoll={onRoll}
              sets={scratch.sets}
              onKeep={onKeep}
              accent={accent}
            />
          )}

          <StatRune
            pool={scratch.pool}
            bound={bound}
            scores={rawScores}
            accent={accent}
            onBind={onBind}
            onRelease={onRelease}
          />
        </>
      )}
    </div>
  );
}

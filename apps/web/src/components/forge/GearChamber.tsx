import type { ComponentProps, ReactNode } from "react";

import Attunement from "@/components/forge/Attunement";
import CarryingLoad from "@/components/forge/CarryingLoad";
import GearBag from "@/components/forge/GearBag";
import ItemFacts from "@/components/forge/ItemFacts";
import RarityScry from "@/components/forge/RarityScry";
import StartingKit from "@/components/forge/StartingKit";
import WeaponMastery from "@/components/forge/WeaponMastery";
import type { CatalogEntry } from "@/lib/catalog";
import type { Purse } from "@/lib/purse";
import { coinLabel } from "@/lib/starting-kit";
import { DIVIDER, LABEL_MB2, LABEL_MB4, WHISPER_MB4 } from "@/styles/recipes";

type Facts = ComponentProps<typeof ItemFacts>["facts"] | null | undefined | false;

/** What the character carries and wears: the class kit, a weapon, armor, the bag. */
export default function GearChamber({
  kitRows,
  kitChoices,
  onAnswerKit,
  weaponSearch,
  armorSearch,
  weaponId,
  armorId,
  onPickWeapon,
  onPickArmor,
  weaponFacts,
  armorFacts,
  weaponWarning,
  armorWarning,
  masteryPlan,
  weaponMasteryIds,
  masteryProblems,
  onToggleMastery,
  castsAnything,
  carried,
  gearSearch,
  rulesVersion,
  onAddGear,
  onRemoveGear,
  load,
  attunement,
  onToggleAttunement,
  purse,
  accent,
}: {
  kitRows: ComponentProps<typeof StartingKit>["rows"];
  kitChoices: ComponentProps<typeof StartingKit>["choices"];
  onAnswerKit: ComponentProps<typeof StartingKit>["onAnswer"];
  weaponSearch: ComponentProps<typeof RarityScry>["search"];
  armorSearch: ComponentProps<typeof RarityScry>["search"];
  weaponId: string;
  armorId: string;
  onPickWeapon: (entry: CatalogEntry) => void;
  onPickArmor: (entry: CatalogEntry) => void;
  weaponFacts: Facts;
  armorFacts: Facts;
  weaponWarning: ReactNode;
  armorWarning: ReactNode;
  masteryPlan: Pick<ComponentProps<typeof WeaponMastery>, "options" | "count" | "meleeOnly">;
  weaponMasteryIds: ComponentProps<typeof WeaponMastery>["chosen"];
  masteryProblems: ComponentProps<typeof WeaponMastery>["problems"];
  onToggleMastery: ComponentProps<typeof WeaponMastery>["onToggle"];
  castsAnything: boolean;
  carried: ComponentProps<typeof GearBag>["carried"];
  gearSearch: ComponentProps<typeof GearBag>["search"];
  rulesVersion: ComponentProps<typeof GearBag>["rulesVersion"];
  onAddGear: ComponentProps<typeof GearBag>["onAdd"];
  onRemoveGear: ComponentProps<typeof GearBag>["onRemove"];
  load: ComponentProps<typeof CarryingLoad>["load"];
  attunement: ComponentProps<typeof Attunement>["state"];
  onToggleAttunement: ComponentProps<typeof Attunement>["onToggle"];
  purse: Purse;
  accent: string;
}) {
  return (
    <div className="max-w-xl space-y-10">
      {/*
        What the class hands you at level 1.
        Printed in the class entry and, until now, nowhere in this
        front: a fighter arrived at this chamber with three empty
        search boxes and no idea that the book already gave them
        chain mail, a martial weapon and a shield.
      */}
      <StartingKit
        rows={kitRows}
        choices={kitChoices}
        accent={accent}
        onAnswer={onAnswerKit}
      />

      <div className={kitRows.length > 0 ? DIVIDER : ""}>
        <p className={LABEL_MB2}>
          Arma
        </p>
        <p className={WHISPER_MB4}>
          Tu arma principal. Si el equipo inicial te da mas de una, las demas van en Equipo adicional.
        </p>
        <RarityScry
          infoKind="item"
          rulesVersion={rulesVersion}
          label="Buscar arma"
          placeholder="Buscar arma…"
          search={weaponSearch}
          selectedId={weaponId}
          onPick={onPickWeapon}
          accent={accent}
        />
        {weaponFacts && <ItemFacts facts={weaponFacts} accent={accent} />}
        {weaponWarning && (
          <p className="mt-3 font-body text-[15px] text-ember">{weaponWarning}</p>
        )}
      </div>

      <div className={DIVIDER}>
        <p className={LABEL_MB2}>
          Armadura
        </p>
        <p className={WHISPER_MB4}>Dejala vacia para ir sin armadura.</p>
        <RarityScry
          infoKind="item"
          rulesVersion={rulesVersion}
          label="Buscar armadura"
          placeholder="Buscar armadura o escudo…"
          search={armorSearch}
          selectedId={armorId}
          onPick={onPickArmor}
          accent={accent}
        />
        {armorFacts && <ItemFacts facts={armorFacts} accent={accent} />}
        {armorWarning && (
          <p className="mt-3 font-body text-[15px] text-ember">{armorWarning}</p>
        )}
      </div>

      {masteryPlan.count > 0 && (
        <div className={DIVIDER}>
          <WeaponMastery
            options={masteryPlan.options}
            chosen={weaponMasteryIds}
            count={masteryPlan.count}
            meleeOnly={masteryPlan.meleeOnly}
            problems={masteryProblems}
            accent={accent}
            onToggle={onToggleMastery}
          />
        </div>
      )}

      <div className={DIVIDER}>
        <p className={LABEL_MB2}>
          Equipo adicional
        </p>
        <p className={WHISPER_MB4}>
          {castsAnything
            ? "El libro de conjuros va aca."
            : "Mochila, cuerda, raciones, herramientas y las armas de repuesto."}
        </p>
        <GearBag
          carried={carried}
          search={gearSearch}
          rulesVersion={rulesVersion}
          accent={accent}
          onAdd={onAddGear}
          onRemove={onRemoveGear}
        />

        {(purse.startingCopper > 0 || purse.purchases.length > 0) && (
          <div className={DIVIDER}>
            <PurseLine purse={purse} accent={accent} />
          </div>
        )}

        <div className={DIVIDER}>
          <CarryingLoad load={load} accent={accent} />
        </div>

        {attunement.offered.length > 0 && (
          <div className={DIVIDER}>
            <Attunement
              state={attunement}
              accent={accent}
              onToggle={onToggleAttunement}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The coins, after what was bought with them.
 *
 * Shown as soon as there is money or a purchase: a player who took the gold and
 * is filling the bag by hand needs to see it go down while they shop, not find
 * out at the table.
 */
function PurseLine({ purse, accent }: { purse: Purse; accent: string }) {
  const owed = purse.balanceCopper < 0;

  return (
    <div>
      <p className={LABEL_MB2}>Monedas</p>
      <p className="font-body text-[15px] leading-relaxed text-bone">
        {purse.startingCopper > 0 ? (
          <>
            Empezas con <span style={{ color: accent }}>{coinLabel(purse.startingCopper)}</span>
          </>
        ) : (
          <>Tu equipo inicial no trae monedas</>
        )}
        {purse.spentCopper > 0 && (
          <>
            , gastas <span style={{ color: accent }}>{coinLabel(purse.spentCopper)}</span> en lo que agregaste
          </>
        )}
        {owed ? "." : (
          <>
            {" "}y te queda{" "}
            <span style={{ color: accent }}>{coinLabel(purse.balanceCopper) || "nada"}</span>.
          </>
        )}
      </p>
      {owed && (
        <p className="mt-2 font-body text-[15px] text-ember">
          Te faltan {coinLabel(-purse.balanceCopper)}. Saca algo o preguntale a tu DM.
        </p>
      )}
      {purse.unpriced > 0 && (
        <p className="mt-2 font-body text-[15px] leading-relaxed text-bone">
          {purse.unpriced === 1
            ? "Una cosa que agregaste no tiene precio en el libro y no descuenta."
            : `${purse.unpriced} cosas que agregaste no tienen precio en el libro y no descuentan.`}
        </p>
      )}
    </div>
  );
}

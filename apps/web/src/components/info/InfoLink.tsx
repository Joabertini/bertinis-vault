/**
 * A name anywhere on the page that opens its entry in the info panel.
 *
 * Styled as the links inside the panel are, so a name that can be opened always looks the same.
 * Outside a provider it still renders, and does nothing.
 */

import type { ReactNode } from "react";

import { useInfo } from "@/components/info/info-context";
import type { RuleRef } from "@/lib/rules-markup";

export default function InfoLink({
  target,
  accent,
  className = "",
  children,
}: {
  target: RuleRef;
  accent: string;
  className?: string;
  children: ReactNode;
}) {
  const { show } = useInfo();

  return (
    <button
      type="button"
      onClick={() => show(target)}
      title={target.name}
      className={`cursor-pointer text-left underline decoration-dotted underline-offset-4 transition-colors hover:decoration-solid ${className}`}
      style={{ color: accent }}
    >
      {children}
    </button>
  );
}

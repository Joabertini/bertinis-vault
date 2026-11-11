/**
 * What the floating info panel is showing, and the way to change it.
 *
 * Anything on the page can ask the panel to show an entry — a card, a list row, a link inside
 * another entry's text. Asking outside a provider does nothing, so a component that offers info
 * still renders where there is no panel (a test, the share page).
 *
 * Hovering replaces what is shown, because moving along a list is how someone reads it. Following a
 * link inside the panel pushes, because that is a trail the reader wants to walk back.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { RuleRef } from "@/lib/rules-markup";
import type { Edition } from "@/lib/rules-text";

type ShowOptions = {
  /** A pointer passing over it, as opposed to a deliberate choice. Ignored on screens too narrow for a side panel. */
  hover?: boolean;
  /** Add to the trail instead of replacing it. */
  push?: boolean;
};

type InfoApi = {
  stack: RuleRef[];
  edition: Edition;
  show: (ref: RuleRef, options?: ShowOptions) => void;
  back: () => void;
  close: () => void;
};

const NOTHING: InfoApi = {
  stack: [],
  edition: "2024",
  show: () => undefined,
  back: () => undefined,
  close: () => undefined,
};

const InfoContext = createContext<InfoApi>(NOTHING);

/** Wide enough that the left margin holds a panel without covering the page. */
const SIDE_PANEL = "(min-width: 1500px)";

export function InfoProvider({ edition, children }: { edition: Edition; children: ReactNode }) {
  const [stack, setStack] = useState<RuleRef[]>([]);

  const show = useCallback((ref: RuleRef, options: ShowOptions = {}) => {
    if (options.hover && !window.matchMedia(SIDE_PANEL).matches) return;
    setStack((current) => (options.push ? [...current, ref] : [ref]));
  }, []);

  const back = useCallback(() => setStack((current) => current.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);

  const value = useMemo(() => ({ stack, edition, show, back, close }), [stack, edition, show, back, close]);
  return <InfoContext.Provider value={value}>{children}</InfoContext.Provider>;
}

export function useInfo(): InfoApi {
  return useContext(InfoContext);
}

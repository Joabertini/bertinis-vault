import { describe, expect, it } from "vitest";

import { leerDisponibles } from "@/lib/faro";

describe("leerDisponibles", () => {
  it("keeps valid ids marked true", () => {
    expect(leerDisponibles({ faro: { disponibles: { a: true, "b-2_x": true } } })).toEqual({ a: true, "b-2_x": true });
  });

  it("drops bad ids and non-true values", () => {
    expect(leerDisponibles({ faro: { disponibles: { "con espacio": true, ok: true, texto: "true", falso: false } } })).toEqual({ ok: true });
  });

  it("is null when the message carries no map", () => {
    expect(leerDisponibles({ faro: { versiones: {} } })).toBeNull();
    expect(leerDisponibles(null)).toBeNull();
    expect(leerDisponibles({ faro: { disponibles: ["a"] } })).toBeNull();
  });

  it("keeps at most 200", () => {
    const many = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`p${i}`, true]));
    expect(Object.keys(leerDisponibles({ faro: { disponibles: many } })!).length).toBe(200);
  });
});

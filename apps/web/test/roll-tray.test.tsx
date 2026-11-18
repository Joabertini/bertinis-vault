/**
 * La bandeja de dados: lo que se tira en la hoja cae ahí, y lo que se escribe en ella se tira.
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RollTray from "../src/components/tray/RollTray";
import { isFormula, rollFormula } from "../src/lib/roll-formula";
import { useRolls } from "../src/lib/roll-store";

/** Dados que dan lo que se les pide, en orden, y 1 cuando se acaban. */
const loaded = (...faces: number[]) => {
  const queue = [...faces];
  return () => queue.shift() ?? 1;
};

describe("fórmulas", () => {
  test("suma los dados y lo fijo", () => {
    const result = rollFormula("2d6+3", "normal", loaded(4, 5));
    expect(result.total).toBe(12);
    expect(result.detalle).toBe("2d6 [4, 5] +3");
    expect(result.d20).toBeNull();
  });

  test("resta, y acepta espacios y la d sola", () => {
    expect(rollFormula("d20 - 2", "normal", loaded(15)).total).toBe(13);
    expect(rollFormula("1d8-1", "normal", loaded(8)).total).toBe(7);
  });

  test("ventaja se queda con el mayor d20 y desventaja con el menor", () => {
    const up = rollFormula("1d20+5", "ventaja", loaded(7, 16));
    expect(up.total).toBe(21);
    expect(up.d20).toBe(16);
    expect(up.pair).toEqual([7, 16]);
    expect(rollFormula("1d20+5", "desventaja", loaded(7, 16)).total).toBe(12);
  });

  test("la ventaja no toca los demás dados", () => {
    const result = rollFormula("2d6+3", "ventaja", loaded(4, 5));
    expect(result.total).toBe(12);
    expect(result.pair).toBeNull();
  });

  test("solo acepta dados y números", () => {
    expect(isFormula("1d20+7")).toBe(true);
    expect(isFormula("d20")).toBe(true);
    expect(isFormula("")).toBe(false);
    expect(isFormula("7")).toBe(false);
    expect(isFormula("1d20+hola")).toBe(false);
    expect(isFormula("alert(1)")).toBe(false);
  });
});

describe("la bandeja", () => {
  beforeEach(() => useRolls.setState({ rolls: [] }));
  afterEach(cleanup);

  test("muestra la última tirada, que llega desde la hoja, y guarda el historial", () => {
    render(<RollTray />);
    expect(screen.getByText("Todavía no tiraste nada.")).toBeTruthy();

    act(() => {
      useRolls.getState().push({ titulo: "Stealth", formula: "1d20+4", total: 24, detalle: "1d20 [20] +4", modo: "normal", d20: 20, aviso: null });
      useRolls.getState().push({ titulo: "Dado de golpe", formula: "1d8+2", total: 9, detalle: "1d8 [7] +2", modo: "normal", d20: null, aviso: null });
    });

    expect(screen.getByText("Dado de golpe")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    // La anterior pasa al historial, con su total.
    expect(screen.getByText("Stealth")).toBeTruthy();
    expect(screen.getByText("24")).toBeTruthy();
  });

  test("un aviso de la hoja se muestra como texto, no como número", () => {
    render(<RollTray />);
    act(() => {
      useRolls.getState().push({ titulo: "Descanso largo", formula: "", total: null, detalle: "", modo: "normal", d20: null, aviso: "38 / 38 · Vida al máximo" });
    });
    expect(screen.getByText("Descanso largo")).toBeTruthy();
    expect(screen.getByText("38 / 38 · Vida al máximo")).toBeTruthy();
  });

  test("tira lo que se escribe, y una fórmula inválida no tira", async () => {
    const user = userEvent.setup();
    render(<RollTray />);

    await user.type(screen.getByLabelText("Fórmula de dados"), "1d6+2");
    await user.click(screen.getByText("Tirar"));
    expect(useRolls.getState().rolls).toHaveLength(1);
    expect(useRolls.getState().rolls[0]!.formula).toBe("1d6+2");

    await user.clear(screen.getByLabelText("Fórmula de dados"));
    await user.type(screen.getByLabelText("Fórmula de dados"), "hola");
    await user.click(screen.getByText("Tirar"));
    expect(useRolls.getState().rolls).toHaveLength(1);
  });

  test("los botones de dado tiran un dado solo", async () => {
    const user = userEvent.setup();
    render(<RollTray />);
    await user.click(screen.getByRole("button", { name: "20" }));
    const [roll] = useRolls.getState().rolls;
    expect(roll!.formula).toBe("1d20");
    expect(roll!.total).toBeGreaterThanOrEqual(1);
    expect(roll!.total).toBeLessThanOrEqual(20);
  });

  test("limpiar vacía el historial", async () => {
    const user = userEvent.setup();
    render(<RollTray />);
    await user.click(screen.getByRole("button", { name: "6" }));
    await user.click(screen.getByText("Limpiar"));
    expect(useRolls.getState().rolls).toHaveLength(0);
  });
});

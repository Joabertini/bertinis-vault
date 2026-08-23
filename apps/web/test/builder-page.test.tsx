import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { App } from "../src/App";

afterEach(cleanup);

/**
 * Emptying a text field used to unmount the whole tree, leaving a blank page
 * that only a reload recovered from.
 */
test("clearing the character name leaves the builder standing", async () => {
  const user = userEvent.setup();
  render(<App />);

  const nameField = screen.getByLabelText(/nombre del personaje/i) as HTMLInputElement;
  await user.clear(nameField);

  expect(nameField.value).toBe("");
  expect(screen.getByLabelText(/nombre del jugador/i)).toBeTruthy();
});

test("clearing the player name leaves the builder standing", async () => {
  const user = userEvent.setup();
  render(<App />);

  const playerField = screen.getByLabelText(/nombre del jugador/i) as HTMLInputElement;
  await user.clear(playerField);

  expect(playerField.value).toBe("");
  expect(screen.getByLabelText(/nombre del personaje/i)).toBeTruthy();
});

test("a nameless draft cannot be published, and says why", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.clear(screen.getByLabelText(/nombre del personaje/i));

  expect(screen.getByText(/falta el nombre del personaje/i)).toBeTruthy();
});

test("the race step searches the whole index and records the book", async () => {
  const user = userEvent.setup();
  render(<App />);

  const next = screen.getByRole("button", { name: /siguiente/i });
  await user.click(next);
  await user.click(next);

  await user.type(screen.getByLabelText(/^raza/i), "aarakocra");

  const rows = await screen.findAllByRole("radio");
  const labels = rows.map((row) => row.closest("label")?.textContent ?? "");

  expect(labels.some((text) => text.includes("Aarakocra") && text.includes("MPMM"))).toBe(true);
});

test("the ruleset can be switched, and says what it does and does not change", async () => {
  const user = userEvent.setup();
  render(<App />);

  const rules = screen.getByLabelText(/reglas/i) as HTMLSelectElement;
  await user.selectOptions(rules, "5e-2024");

  expect(rules.value).toBe("5e-2024");
  expect(screen.getByText(/todavia salen de las tablas de 2014/i)).toBeTruthy();
});

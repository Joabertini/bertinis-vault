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

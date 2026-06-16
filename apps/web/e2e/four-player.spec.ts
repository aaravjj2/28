import { expect, test } from "@playwright/test";

test("four players can create, join, seat, and start without seeing other hands", async ({ browser }) => {
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext())
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));

  for (const [index, page] of pages.entries()) {
    await page.goto("/");
    await page.getByLabel("Your name").fill(`Player${index}`);
  }

  await pages[0]!.getByRole("button", { name: "Create Room" }).click();
  await expect(pages[0]!.getByText("Lobby")).toBeVisible();

  const roomCode = await pages[0]!.locator("span").filter({ hasText: /^[A-Z0-9]{6}$/ }).first().textContent();
  expect(roomCode).toBeTruthy();

  for (let index = 1; index < 4; index += 1) {
    await pages[index]!.getByLabel("Room code").fill(roomCode!);
    await pages[index]!.getByRole("button", { name: "Join Room" }).click();
    await expect(pages[index]!.getByText("Lobby")).toBeVisible();
  }

  for (const [index, page] of pages.entries()) {
    await page.getByRole("button", { name: "Take seat" }).first().click();
    await expect(page.getByText(`Player${index}`)).toBeVisible();
  }

  await pages[0]!.getByRole("button", { name: "Start Game" }).click();

  for (const page of pages) {
    const phaseBox = page.locator(".meta-box").filter({ hasText: "Phase" });
    await expect(phaseBox).toContainText(/BIDDING|PLAYING_TRICKS|TRUMP_SELECTION/, {
      timeout: 15_000,
    });
  }

  for (const page of pages) {
    await expect(page.getByRole("heading", { name: "Table" })).toBeVisible();
    await expect(page.getByText("Seat 0")).toBeVisible();
    const handButtons = page.locator(".hand-card");
    expect(await handButtons.count()).toBe(0);
  }

  for (const context of contexts) {
    await context.close();
  }
});

import { expect, test, type Page } from "@playwright/test";
import { completeBidding } from "./helpers";

async function pageWithVisibleBid(pages: Page[], bid: string): Promise<Page | null> {
  for (const page of pages) {
    const button = page.getByRole("button", { name: bid, exact: true });
    if (await button.isVisible().catch(() => false)) {
      return page;
    }
  }
  return null;
}

test("house profile opens bidding at 16", async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));

  for (const [index, page] of pages.entries()) {
    await page.goto("/");
    await page.getByLabel("Your name").fill(`Player${index}`);
  }

  const host = pages[0]!;
  await host.getByRole("button", { name: "Create Room" }).click();
  await expect(host.getByText("Lobby")).toBeVisible({ timeout: 30_000 });

  await host.getByTestId("rule-profile-select").selectOption("house_28_16_start");
  await expect(host.getByTestId("rule-profile-select")).toHaveValue("house_28_16_start");

  const roomCode = await host
    .locator("span")
    .filter({ hasText: /^[A-Z0-9]{6}$/ })
    .first()
    .textContent();
  expect(roomCode).toBeTruthy();

  for (let index = 1; index < 4; index += 1) {
    await pages[index]!.getByLabel("Room code").fill(roomCode!);
    await pages[index]!.getByRole("button", { name: "Join Room" }).click();
    await expect(pages[index]!.getByText("Lobby")).toBeVisible();
  }

  for (const page of pages) {
    await page.getByRole("button", { name: "Take seat" }).first().click();
  }

  await host.getByRole("button", { name: "Start Game" }).click();
  await expect(host.getByRole("heading", { name: "Table" })).toBeVisible({ timeout: 15_000 });

  await expect
    .poll(async () => pageWithVisibleBid(pages, "16"), { timeout: 15_000 })
    .not.toBeNull();

  const openingPage = await pageWithVisibleBid(pages, "16");
  expect(openingPage).not.toBeNull();
  await expect(openingPage!.getByRole("button", { name: "14", exact: true })).not.toBeVisible();
  await expect(openingPage!.getByRole("button", { name: "15", exact: true })).not.toBeVisible();

  await completeBidding(pages);
  await expect(host.locator("[data-testid='game-phase']")).toHaveAttribute(
    "data-phase",
    "TRUMP_SELECTION"
  );
});

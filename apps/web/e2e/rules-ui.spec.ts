import { expect, test } from "@playwright/test";
import { completeBidding, selectTrump, setupFourPlayers } from "./helpers";

test("table UI shows stake panel and felt layout during play", async ({ browser }) => {
  const { pages } = await setupFourPlayers(browser);
  const page = pages[0]!;

  await completeBidding(pages);
  await selectTrump(pages);

  await expect(page.locator(".felt-table")).toBeVisible();
  await expect(page.locator(".game-info-panel").getByText("Stake", { exact: true })).toBeVisible();
  await expect(page.locator(".game-info-panel").getByText("Bid", { exact: true })).toBeVisible();
  await expect(page.locator("[data-testid='game-phase']")).toHaveAttribute("data-phase", "PLAYING_TRICKS");

  const legalCard = page.locator(".hand-card-btn.legal:not([disabled])").first();
  if (await legalCard.isVisible()) {
    await legalCard.click();
  }

  await expect(page.locator(".game-info-panel")).toBeVisible();
});

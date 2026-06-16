import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  completeBidding,
  playUntilRoundScoring,
  selectTrump,
  setupFourPlayers,
} from "./helpers";

async function playUntilMinTricks(pages: Page[], minTricks: number): Promise<void> {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const trickCounts = await Promise.all(
      pages.map(async (page) => {
        const tricksBox = page.locator(".meta-box").filter({ hasText: "Tricks played" });
        const text = (await tricksBox.textContent()) ?? "0";
        const match = text.match(/(\d+)/);
        return match ? Number(match[1]) : 0;
      })
    );

    if (Math.max(...trickCounts) >= minTricks) {
      return;
    }

    await Promise.all(
      pages.map(async (page) => {
        const legalCard = page.locator(".hand-card.legal:not([disabled])").first();
        if (await legalCard.isVisible()) {
          await legalCard.click();
        }
      })
    );

    await pages[0]!.waitForTimeout(250);
  }

  throw new Error(`Did not reach ${minTricks} tricks`);
}

test.describe("full multiplayer round", () => {
  test("four players complete bidding, trump, full round, reconnect, and match finish", async ({
    browser,
  }) => {
    const { contexts, pages } = await setupFourPlayers(browser);

    await completeBidding(pages);
    await selectTrump(pages);

    for (const page of pages) {
      await expect(page.locator(".meta-box").filter({ hasText: "Phase" })).toContainText(
        "PLAYING_TRICKS",
        { timeout: 15_000 }
      );
      const trumpBox = page
        .locator(".meta-box")
        .filter({ has: page.locator("strong", { hasText: "Trump" }) });
      await expect(trumpBox).not.toContainText(/Hearts|Diamonds|Clubs|Spades/);
    }

    await playUntilMinTricks(pages, 2);

    const reconnectPage = pages[1]!;
    await reconnectPage.reload();
    await expect(reconnectPage.getByRole("button", { name: /Reconnect to/ })).toBeVisible({
      timeout: 10_000,
    });
    await reconnectPage.getByRole("button", { name: /Reconnect to/ }).click();
    await expect(reconnectPage.getByRole("heading", { name: "Table" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(reconnectPage.locator(".hand-card").first()).toBeVisible({ timeout: 15_000 });
    await expect(reconnectPage.getByText("Player1").first()).toBeVisible();

    await playUntilRoundScoring(pages);

    for (const page of pages) {
      const phaseText =
        (await page.locator(".meta-box").filter({ hasText: "Phase" }).textContent()) ?? "";

      if (phaseText.includes("ROUND_SCORING")) {
        await expect(page.getByRole("heading", { name: "Round Summary" })).toBeVisible();
        const teamAPoints = Number(
          await page
            .locator(".meta-box")
            .filter({ hasText: "Team A points" })
            .locator("div")
            .nth(1)
            .textContent()
        );
        const teamBPoints = Number(
          await page
            .locator(".meta-box")
            .filter({ hasText: "Team B points" })
            .locator("div")
            .nth(1)
            .textContent()
        );
        expect(teamAPoints + teamBPoints).toBe(28);
      } else {
        await expect(page.getByRole("heading", { name: "Match Over" })).toBeVisible({
          timeout: 15_000,
        });
        await expect(page.getByText(/Last round points:/)).toBeVisible();
        const lastRoundText = await page.getByText(/Last round points:/).textContent();
        const pointMatches = lastRoundText?.match(/(\d+)/g) ?? [];
        const teamAPoints = Number(pointMatches[0] ?? 0);
        const teamBPoints = Number(pointMatches[1] ?? 0);
        expect(teamAPoints + teamBPoints).toBe(28);
      }
    }

    await pages[0]!.getByRole("button", { name: "Rematch" }).click();
    for (const page of pages) {
      await expect(page.getByText("Lobby")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Player0").first()).toBeVisible();
      await expect(page.getByText("Player1").first()).toBeVisible();
    }

    for (const context of contexts) {
      await context.close();
    }
  });

  test("players never see another player's hand cards", async ({ browser }) => {
    const { contexts, pages } = await setupFourPlayers(browser);
    await completeBidding(pages);
    await selectTrump(pages);

    for (const page of pages) {
      await expect(page.locator(".meta-box").filter({ hasText: "Phase" })).toContainText(
        "PLAYING_TRICKS",
        { timeout: 15_000 }
      );
      const handCards = page.locator(".hand-card");
      await expect(handCards.first()).toBeVisible({ timeout: 15_000 });
      const count = await handCards.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(8);
    }

    for (const context of contexts) {
      await context.close();
    }
  });
});

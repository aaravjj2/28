import { expect, test } from "@playwright/test";
import { completeBidding, playUntilRoundScoring, selectTrump } from "./helpers";

test("one human with three bots completes a full round", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/");
  await page.getByLabel("Your name").fill("Human");
  await page.getByRole("button", { name: "Create Room" }).click();
  await expect(page.getByText("Lobby")).toBeVisible();

  await page.getByRole("button", { name: "Take seat" }).first().click();

  for (let seat = 1; seat < 4; seat += 1) {
    const seatCard = page.locator(".seat-card").filter({ hasText: `Seat ${seat}` });
    await seatCard.getByRole("button", { name: "Add random bot" }).click();
    await expect(seatCard.getByText(/BOT/)).toBeVisible({ timeout: 10_000 });
  }

  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("heading", { name: "Table" })).toBeVisible({ timeout: 15_000 });

  await completeBidding([page]);
  await selectTrump([page]);
  await playUntilRoundScoring([page]);

  if (await page.getByRole("heading", { name: "Match Over" }).isVisible()) {
    await expect(page.getByText(/Last round points:/)).toBeVisible();
    const lastRoundText = await page.getByText(/Last round points:/).textContent();
    const pointMatches = lastRoundText?.match(/(\d+)/g) ?? [];
    expect(Number(pointMatches[0] ?? 0) + Number(pointMatches[1] ?? 0)).toBe(28);
  } else {
    await expect(page.getByRole("heading", { name: "Round Summary" })).toBeVisible();
    await expect(page.getByText("Team A points")).toBeVisible({ timeout: 15_000 });
    const teamAPoints = Number(
      await page.locator(".meta-box").filter({ hasText: "Team A points" }).locator("div").nth(1).textContent()
    );
    const teamBPoints = Number(
      await page.locator(".meta-box").filter({ hasText: "Team B points" }).locator("div").nth(1).textContent()
    );
    expect(teamAPoints + teamBPoints).toBe(28);
  }

  await context.close();
});

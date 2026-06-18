import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function setupFourPlayers(browser: import("@playwright/test").Browser) {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));

  for (const [index, page] of pages.entries()) {
    await page.goto("/");
    await page.getByLabel("Your name").fill(`Player${index}`);
  }

  await pages[0]!.getByRole("button", { name: "Create Room" }).click();
  await expect(pages[0]!.getByText("Lobby")).toBeVisible({ timeout: 30_000 });

  const roomCode = await pages[0]!
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

  await pages[0]!.getByRole("button", { name: "Start Game" }).click();

  for (const page of pages) {
    await expect(page.getByRole("heading", { name: "Table" })).toBeVisible({ timeout: 15_000 });
  }

  return { contexts, pages, roomCode: roomCode! };
}

export const createRoomWithPlayers = setupFourPlayers;

async function getPhases(pages: Page[]): Promise<string[]> {
  return Promise.all(
    pages.map(async (page) => {
      const phase = await page.locator("[data-testid='game-phase']").getAttribute("data-phase");
      return phase ?? "";
    })
  );
}

export async function completeBidding(pages: Page[]): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const phases = await getPhases(pages);
    if (
      phases.every(
        (phase) => phase && phase !== "BIDDING" && phase !== "STAKE_MULTIPLIER"
      )
    ) {
      return;
    }

    await Promise.all(
      pages.map(async (page) => {
        for (const value of [14, 16, 17, 18, 19, 20]) {
          const bidBtn = page.getByRole("button", { name: String(value), exact: true });
          if (await bidBtn.isVisible()) {
            await bidBtn.click();
            return;
          }
        }
        const pass = page.getByRole("button", { name: "Pass" });
        if (await pass.isVisible()) {
          await pass.click();
        }
      })
    );

    await pages[0]!.waitForTimeout(250);
  }

  throw new Error("Bidding did not complete");
}

export async function selectTrump(pages: Page[]): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const phases = await getPhases(pages);
    if (phases.every((phase) => phase === "PLAYING_TRICKS" || phase === "THANI_DECLARATION")) {
      if (phases.some((phase) => phase === "THANI_DECLARATION")) {
        for (const page of pages) {
          const skip = page.getByRole("button", { name: "Skip" });
          if (await skip.isVisible()) {
            await skip.click();
          }
        }
        await pages[0]!.waitForTimeout(300);
      }
      const after = await getPhases(pages);
      if (after.every((phase) => phase === "PLAYING_TRICKS")) {
        return;
      }
    }

    if (!phases.some((phase) => phase === "TRUMP_SELECTION")) {
      await pages[0]!.waitForTimeout(200);
      continue;
    }

    for (const page of pages) {
      const overlay = page.locator(".trump-overlay");
      if (!(await overlay.isVisible())) {
        continue;
      }

      const waitingCopy = page.getByText("Declarer is choosing trump");
      if (await waitingCopy.isVisible()) {
        continue;
      }

      const suitButtons = page.locator(".trump-overlay .suit-grid .btn-primary");
      const suitCount = await suitButtons.count();
      let selectedCard = false;

      for (let index = 0; index < suitCount && !selectedCard; index += 1) {
        const suitButton = suitButtons.nth(index);
        if (!(await suitButton.isVisible())) {
          continue;
        }
        await suitButton.click();
        await page.waitForTimeout(350);

        const trumpCard = page.locator(".trump-overlay .hand-card-btn:not([disabled])").first();
        if (await trumpCard.isVisible()) {
          await trumpCard.click();
          selectedCard = true;
          await pages[0]!.waitForTimeout(400);
          break;
        }

        const changeSuit = page.getByRole("button", { name: "Change suit" });
        if (await changeSuit.isVisible()) {
          await changeSuit.click();
          await page.waitForTimeout(150);
        }
      }
    }

    await pages[0]!.waitForTimeout(250);
  }

  throw new Error("Trump was not selected");
}

export async function playUntilRoundScoring(pages: Page[]): Promise<void> {
  for (let attempt = 0; attempt < 512; attempt += 1) {
    for (const page of pages) {
      const phase = await page.locator("[data-testid='game-phase']").getAttribute("data-phase");
      if (phase === "ROUND_SCORING" || phase === "MATCH_OVER") {
        return;
      }
      if (await page.getByRole("heading", { name: "Match Over" }).isVisible()) {
        return;
      }
      if (await page.getByText("Team A points").isVisible()) {
        return;
      }
      if (await page.getByText(/Last round points:/).isVisible()) {
        return;
      }
    }

    await Promise.all(
      pages.map(async (page) => {
        const legalCard = page.locator(".hand-card-btn.legal:not([disabled])").first();
        if (await legalCard.isVisible()) {
          await legalCard.click();
        }
      })
    );

    await pages[0]!.waitForTimeout(250);
  }

  throw new Error("Round did not reach scoring");
}

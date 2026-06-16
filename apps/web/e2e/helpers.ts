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
  await expect(pages[0]!.getByText("Lobby")).toBeVisible();

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

async function getPhases(pages: Page[]): Promise<string[]> {
  return Promise.all(
    pages.map(async (page) => {
      const phaseBox = page.locator(".meta-box").filter({ hasText: "Phase" });
      return (await phaseBox.textContent()) ?? "";
    })
  );
}

export async function completeBidding(pages: Page[]): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const phases = await getPhases(pages);
    if (phases.every((phase) => !phase.includes("BIDDING"))) {
      return;
    }

    await Promise.all(
      pages.map(async (page) => {
        if (await page.getByText("Your turn to bid.").isVisible()) {
          const bid14 = page.getByRole("button", { name: "Bid 14" });
          if (await bid14.isVisible()) {
            await bid14.click();
            return;
          }
          const pass = page.getByRole("button", { name: "Pass" });
          if (await pass.isVisible()) {
            await pass.click();
          }
        }
      })
    );

    await pages[0]!.waitForTimeout(200);
  }

  throw new Error("Bidding did not complete");
}

export async function selectTrump(pages: Page[]): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const phases = await getPhases(pages);
    if (phases.every((phase) => phase.includes("PLAYING_TRICKS"))) {
      return;
    }

    for (const page of pages) {
      if (!(await page.getByText("Choose your hidden trump suit.").isVisible())) {
        continue;
      }

      const buttons = page.locator(".suit-grid .btn-primary");
      const buttonCount = await buttons.count();
      for (let index = 0; index < buttonCount; index += 1) {
        await buttons.nth(index).click();
        await pages[0]!.waitForTimeout(400);
        const afterClick = await getPhases(pages);
        if (afterClick.every((phase) => phase.includes("PLAYING_TRICKS"))) {
          return;
        }
      }
    }

    await pages[0]!.waitForTimeout(200);
  }

  throw new Error("Trump was not selected");
}

export async function playUntilRoundScoring(pages: Page[]): Promise<void> {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const phases = await getPhases(pages);
    if (phases.some((phase) => phase.includes("ROUND_SCORING") || phase.includes("MATCH_OVER"))) {
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

    await pages[0]!.waitForTimeout(200);
  }

  throw new Error("Round did not reach scoring");
}

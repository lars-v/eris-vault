import type { Role } from "@/db/schema";
import { ABILITY_SOURCE } from "@/lib/rules/abilities";
import { EQUIPMENT_SOURCE } from "@/lib/rules/equipment";

/**
 * First-time guides: short tours that point at parts of a page.
 * The copy only describes the app. Where a step states a rule, it names the page,
 * using the same wording the build page already shows.
 */
export const GUIDE_KEYS = ["welcome", "build"] as const;
export type GuideKey = (typeof GUIDE_KEYS)[number];

export const isGuideKey = (k: unknown): k is GuideKey => GUIDE_KEYS.includes(k as GuideKey);

export type GuideStep = {
  /** `data-guide` value of the element to point at. Without one the card sits in the middle of the screen. */
  target?: string;
  title: string;
  body: string;
  source?: string;
  /** Label for a step that asks the reader to press the highlighted control themselves. */
  action?: string;
};

export function welcomeSteps(v: { name: string | null; role: Role; canLinkSignIns: boolean }): GuideStep[] {
  const staff = v.role === "gm" || v.role === "admin";
  const first = v.name?.trim().split(/\s+/)[0];
  const steps: GuideStep[] = [
    {
      title: first ? `Welcome to Eris Vault, ${first}` : "Welcome to Eris Vault",
      body: "This is where the table keeps its characters for the Planet Eris campaign. Here is a quick look at what's where.",
    },
    {
      target: "party",
      title: "The party",
      body: staff
        ? "Every character at the table, with hit points and status. Anyone signed in can open any sheet. As GM you can change any of them."
        : "Every character at the table, with hit points and status. Anyone signed in can open any sheet. You can change your own.",
    },
    {
      target: "nav-rolls",
      title: "The roll log",
      body: "The server rolls every die, and every roll lands here for the whole table to see. Rolls can't be changed or removed.",
    },
  ];
  if (staff) {
    steps.push({
      target: "nav-gm",
      title: "GM tools",
      body: "Characters sent for approval wait here. Open one to approve it, return it, or grant a re-roll. Questions the books leave open wait in the rulings ledger, and every GM and admin action is in the audit log.",
    });
  }
  if (v.role === "admin") {
    steps.push({
      target: "nav-admin",
      title: "Admin",
      body: "Set roles, block or merge accounts, and make GM claim links. Admins listed on Railway can't be changed here.",
    });
  }
  steps.push(
    {
      target: "nav-account",
      title: "Your account",
      body: v.canLinkSignIns
        ? "See which sign-ins open this account, and link another so either one opens the same characters."
        : "See which sign-ins open this account.",
    },
    {
      target: "nav-guide",
      title: "This guide",
      body: "Press Guide to see these tips again. The character builder has tips of its own.",
    },
    {
      target: "new-character",
      title: "Your first character",
      body: "The server rolls 3d6 six times for you. Then you build the rest step by step and send it to Jay for approval.",
      source: ABILITY_SOURCE,
      action: "Start a character",
    },
  );
  return steps;
}

export function buildSteps(): GuideStep[] {
  return [
    {
      target: "abilities",
      title: "Your six rolls",
      body: "The server rolled 3d6 six times, and the dice are already in the roll log. Give each set to one ability, then press Save abilities. The die button arranges them at random.",
      source: ABILITY_SOURCE,
    },
    {
      target: "identity",
      title: "Who they are",
      body: "Choose a name, race, class and alignment. Each die button picks at random within the rules for what you've chosen so far. Random picks only fill the form; nothing is saved until you press Save.",
      source: "Woundwort's Warren pp. 8-10",
    },
    {
      target: "hp",
      title: "Hit points",
      body: "Once abilities and class are saved, roll 1d6 adjusted by class and Constitution, at least 3. After this roll, abilities, race and class are fixed.",
      source: "Woundwort's Warren pp. 5-6",
    },
    {
      target: "gold",
      title: "Starting gold",
      body: "Roll 3d6 × 10 gold pieces. By campaign ruling, this is what you have left after buying your kit.",
      source: "Men & Magic p. 10; campaign ruling",
    },
    {
      target: "kit",
      title: "Starting kit",
      body: "Pick from the price list, or press Random basic kit. Items your class can't use are marked and can't be picked, and Jay approves the kit. Item weights are still waiting on p. 18, so encumbrance is a floor for now.",
      source: EQUIPMENT_SOURCE,
    },
    {
      target: "send",
      title: "Send to Jay",
      body: "When steps 1 to 4 are done, send the character to Jay. Until Jay approves it, you can still delete it from the party page.",
    },
  ];
}

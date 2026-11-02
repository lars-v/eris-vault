import { describe, expect, it } from "vitest";
import { buildSteps, isGuideKey, welcomeSteps } from "@/lib/guide";

const targets = (steps: { target?: string }[]) => steps.map((s) => s.target);

describe("welcome guide", () => {
  it("shows players only what players can open", () => {
    const t = targets(welcomeSteps({ name: "Pat Quill", role: "player", canLinkSignIns: true }));
    expect(t).not.toContain("nav-gm");
    expect(t).not.toContain("nav-admin");
    expect(t).toContain("nav-rolls");
  });

  it("adds GM tools for the GM and both staff pages for the admin", () => {
    const gm = targets(welcomeSteps({ name: "Jay", role: "gm", canLinkSignIns: true }));
    expect(gm).toContain("nav-gm");
    expect(gm).not.toContain("nav-admin");
    const admin = targets(welcomeSteps({ name: "Lars", role: "admin", canLinkSignIns: true }));
    expect(admin).toEqual(expect.arrayContaining(["nav-gm", "nav-admin"]));
  });

  it("greets by first name, or plainly without one", () => {
    expect(welcomeSteps({ name: "Pat Quill", role: "player", canLinkSignIns: false })[0].title).toBe("Welcome to Eris Vault, Pat");
    expect(welcomeSteps({ name: null, role: "player", canLinkSignIns: false })[0].title).toBe("Welcome to Eris Vault");
  });

  it("offers linking only when there is a second sign-in to link", () => {
    const account = (canLinkSignIns: boolean) =>
      welcomeSteps({ name: null, role: "player", canLinkSignIns }).find((s) => s.target === "nav-account")!.body;
    expect(account(true)).toMatch(/link another/);
    expect(account(false)).not.toMatch(/link/);
  });

  it("ends by asking for a press on New character", () => {
    const steps = welcomeSteps({ name: null, role: "player", canLinkSignIns: false });
    expect(steps.at(-1)).toMatchObject({ target: "new-character", action: expect.any(String) });
    expect(steps.filter((s) => s.action)).toHaveLength(1);
  });
});

describe("build guide", () => {
  it("walks the build page in order and ends at sending to Jay", () => {
    expect(targets(buildSteps())).toEqual(["abilities", "identity", "hp", "gold", "kit", "send"]);
  });

  it("names a source for every step that states a rule", () => {
    for (const s of buildSteps().slice(0, 5)) expect(s.source).toMatch(/p{1,2}\. \d/);
  });
});

describe("guide copy", () => {
  it("uses no em dashes or double dashes", () => {
    const all = [...welcomeSteps({ name: "A", role: "admin", canLinkSignIns: true }), ...buildSteps()];
    for (const s of all) expect(`${s.title} ${s.body} ${s.source ?? ""}`).not.toMatch(/—|--/);
  });

  it("accepts only known guide keys", () => {
    expect(isGuideKey("welcome")).toBe(true);
    expect(isGuideKey("build")).toBe(true);
    expect(isGuideKey("anything")).toBe(false);
  });
});

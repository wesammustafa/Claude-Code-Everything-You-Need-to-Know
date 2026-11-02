import { afterEach, describe, expect, test, vi } from "vitest";
import {
  applyMotion,
  applyTheme,
  readMotion,
  readTheme,
  restoreSettings,
} from "./settings";

const root = document.documentElement;

afterEach(() => {
  vi.restoreAllMocks();
  delete root.dataset.theme;
  delete root.dataset.motion;
  localStorage.clear();
});

describe("reading a choice", () => {
  test("is system with nothing stored", () => {
    expect(readTheme()).toBe("system");
    expect(readMotion()).toBe("system");
  });

  test("is system for a value it does not know", () => {
    localStorage.setItem("quest.theme", "sepia");
    localStorage.setItem("quest.motion", "slow");
    expect(readTheme()).toBe("system");
    expect(readMotion()).toBe("system");
  });

  test("is system when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readTheme()).toBe("system");
    expect(readMotion()).toBe("system");
  });
});

describe("applying a choice", () => {
  test("sets the attribute and the key, and system removes both", () => {
    applyTheme("dark");
    applyMotion("reduce");
    expect(root.dataset.theme).toBe("dark");
    expect(root.dataset.motion).toBe("reduce");
    expect(localStorage.getItem("quest.theme")).toBe("dark");
    expect(localStorage.getItem("quest.motion")).toBe("reduce");
    expect(readTheme()).toBe("dark");
    expect(readMotion()).toBe("reduce");
    applyTheme("system");
    applyMotion("system");
    expect(root).not.toHaveAttribute("data-theme");
    expect(root).not.toHaveAttribute("data-motion");
    expect(localStorage.getItem("quest.theme")).toBeNull();
    expect(localStorage.getItem("quest.motion")).toBeNull();
  });

  test("keeps the attribute when storage refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    applyTheme("light");
    applyMotion("full");
    expect(root.dataset.theme).toBe("light");
    expect(root.dataset.motion).toBe("full");
  });
});

describe("restoring", () => {
  test("applies the stored choices", () => {
    localStorage.setItem("quest.theme", "light");
    localStorage.setItem("quest.motion", "full");
    restoreSettings();
    expect(root.dataset.theme).toBe("light");
    expect(root.dataset.motion).toBe("full");
  });

  test("writes nothing when nothing is stored", () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    restoreSettings();
    expect(set).not.toHaveBeenCalled();
    expect(root).not.toHaveAttribute("data-theme");
    expect(root).not.toHaveAttribute("data-motion");
    expect(localStorage).toHaveLength(0);
  });
});

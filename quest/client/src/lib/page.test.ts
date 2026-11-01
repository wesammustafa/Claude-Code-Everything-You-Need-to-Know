import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useResolvedTheme } from "./page";

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

test("the theme follows data-theme on <html>, else the system", async () => {
  const { result } = renderHook(() => useResolvedTheme());
  // jsdom has no matchMedia: the system theme reads as light.
  expect(result.current).toBe("light");
  await act(async () => {
    document.documentElement.dataset.theme = "dark";
    await Promise.resolve();
  });
  expect(result.current).toBe("dark");
  await act(async () => {
    document.documentElement.dataset.theme = "light";
    await Promise.resolve();
  });
  expect(result.current).toBe("light");
});

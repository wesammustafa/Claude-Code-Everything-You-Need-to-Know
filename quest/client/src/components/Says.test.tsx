import { act, render, screen } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";
import { renderWithMotion, setMotionSwitch } from "../../test/motion";
import { envelope } from "../../test/events";
import { expectStylesFromTokens } from "../../test/token-classes";
import { motionTokens, saysEntrance } from "../lib/motion";
import { PipStageProvider, usePipInput, usePipModel } from "../pip/PipStage";
import { Says, type SaysTone } from "./Says";

const words = () =>
  screen.getByRole("status").querySelector<HTMLElement>("[data-says-words]");

test("says the status in a polite live region beside Pip", () => {
  const { container } = render(<Says>Watching your Practice copy.</Says>);
  const bubble = screen.getByRole("status");
  expect(bubble).toHaveAttribute("aria-live", "polite");
  expect(bubble).toHaveTextContent("Watching your Practice copy.");
  expect(container.querySelector("[data-pip=beside]")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test.each<[SaysTone, string]>([
  ["watching", "border-teal-edge"],
  ["checking", "border-accent-edge"],
  ["notYet", "border-wait"],
  ["passed", "border-pass"],
  ["broken", "border-broken"],
  ["offer", "border-accent-edge"],
])("the %s bubble takes its status colour from tokens", (tone, border) => {
  render(<Says tone={tone}>Status</Says>);
  const bubble = screen.getByRole("status");
  expect(bubble.className).toContain(border);
  // The border's change is a CSS transition, from tokens.
  expect(bubble.className).toContain("duration-(--duration-base)");
  expectStylesFromTokens(bubble.className);
});

test("fades the words in again when they change, keeping the live region", () => {
  const { rerender } = renderWithMotion(<Says textKey="a">First</Says>);
  const bubble = screen.getByRole("status");
  const first = words();
  expect(first).not.toBeNull();
  rerender(<Says textKey="b">Second</Says>);
  expect(screen.getByRole("status")).toBe(bubble);
  expect(words()).not.toBe(first);
  expect(bubble).toHaveTextContent("Second");
});

test("the words wait --says-delay after the border, then rise a third of --rise", () => {
  renderWithMotion(<Says textKey="a">Checking</Says>);
  const t = { ...motionTokens(), reduced: false };
  const entrance = saysEntrance(t);
  expect(entrance.transition.delay).toBe(t.saysDelay);
  expect(t.saysDelay).toBe(0.08);
  expect(entrance.transition.duration).toBe(t.base);
  // They start below their place, then rise into it.
  expect(words()?.style.opacity).toBe("0");
  expect(words()?.style.transform).toMatch(/translateY\(2\.66/);
});

test("under reduced motion the words only fade, still after the delay", async () => {
  await setMotionSwitch("reduce");
  renderWithMotion(<Says textKey="a">Checking</Says>);
  expect(words()?.style.opacity).toBe("0");
  expect(words()?.style.transform).toBe("");
  const t = { ...motionTokens(), reduced: true };
  expect(saysEntrance(t).transition).toMatchObject({
    delay: 0.08,
    duration: 0.12,
  });
});

test("Pip's Reaction starts no later than the commit that gives the bubble its new tone", async () => {
  const passed = envelope({ type: "check.passed", firstTime: true });
  // Each commit's tone, with the director's Reaction at that moment.
  const commits: { tone: SaysTone; reaction: string | null }[] = [];

  function Step() {
    const send = usePipInput();
    const model = usePipModel();
    const [tone, setTone] = useState<SaysTone>("checking");
    useLayoutEffect(() => {
      commits.push({ tone, reaction: model.reaction?.id ?? null });
    });
    return (
      <>
        <button
          type="button"
          onClick={() => {
            // The rule for every screen: the event reaches Pip's stage
            // first, then the snapshot that changes the tone.
            send({ type: "events", events: [passed] });
            setTone("passed");
          }}
        >
          Check
        </button>
        <Says tone={tone} textKey={tone} pip={null}>
          {tone}
        </Says>
      </>
    );
  }

  render(
    <MemoryRouter initialEntries={["/lesson/b-1/step"]}>
      <PipStageProvider>
        <Step />
      </PipStageProvider>
    </MemoryRouter>,
  );
  await act(async () => {
    screen.getByRole("button", { name: "Check" }).click();
    await Promise.resolve();
  });
  const first = commits.find((c) => c.tone === "passed");
  expect(first?.reaction).toBe(passed.id);
});

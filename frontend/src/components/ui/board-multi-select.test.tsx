import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BoardMultiSelect, type BoardOption } from "./board-multi-select";

// cmdk uses ResizeObserver and scrollIntoView internally; jsdom doesn't provide them.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  Element.prototype.scrollIntoView = vi.fn();
});

const boards: BoardOption[] = [
  { value: "b1", label: "Alpha Board" },
  { value: "b2", label: "Beta Board" },
  { value: "b3", label: "Gamma Board" },
];

function setup(overrides: Partial<Parameters<typeof BoardMultiSelect>[0]> = {}) {
  const onSelectedChange = vi.fn();
  const onPrimaryChange = vi.fn();
  const props = {
    options: boards,
    selected: [] as string[],
    primaryId: null as string | null,
    onSelectedChange,
    onPrimaryChange,
    ...overrides,
  };
  const result = render(<BoardMultiSelect {...props} />);
  return { ...result, onSelectedChange, onPrimaryChange };
}

describe("BoardMultiSelect", () => {
  it("renders placeholder when nothing selected", () => {
    setup();
    expect(screen.getByRole("combobox")).toHaveTextContent("Select boards…");
  });

  it("shows selected count when boards are selected", () => {
    setup({ selected: ["b1", "b2"] });
    expect(screen.getByRole("combobox")).toHaveTextContent("2 boards selected");
  });

  it("shows singular label for single selection", () => {
    setup({ selected: ["b1"] });
    expect(screen.getByRole("combobox")).toHaveTextContent("1 board selected");
  });

  it("opens dropdown and shows board options on click", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByText("Alpha Board")).toBeInTheDocument();
    expect(screen.getByText("Beta Board")).toBeInTheDocument();
    expect(screen.getByText("Gamma Board")).toBeInTheDocument();
  });

  it("calls onSelectedChange when a board is toggled on", async () => {
    const user = userEvent.setup();
    const { onSelectedChange, onPrimaryChange } = setup();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Alpha Board"));

    expect(onSelectedChange).toHaveBeenCalledWith(["b1"]);
    // First board auto-sets as primary
    expect(onPrimaryChange).toHaveBeenCalledWith("b1");
  });

  it("calls onSelectedChange to remove a board when toggled off", async () => {
    const user = userEvent.setup();
    const { onSelectedChange } = setup({
      selected: ["b1", "b2"],
      primaryId: "b1",
    });

    await user.click(screen.getByRole("combobox"));
    // When popover is open, labels appear in both badges and dropdown.
    // Target the dropdown item via its role.
    const options = screen.getAllByText("Beta Board");
    const dropdownOption = options.find((el) => el.closest("[cmdk-item]"));
    await user.click(dropdownOption ?? options[options.length - 1]);

    expect(onSelectedChange).toHaveBeenCalledWith(["b1"]);
  });

  it("renders selected board badges", () => {
    setup({ selected: ["b1", "b2"], primaryId: "b1" });

    expect(screen.getByText("Alpha Board")).toBeInTheDocument();
    expect(screen.getByText("Beta Board")).toBeInTheDocument();
  });

  it("calls onPrimaryChange when primary is removed and fallback triggers", async () => {
    const user = userEvent.setup();
    const { onSelectedChange, onPrimaryChange } = setup({
      selected: ["b1", "b2"],
      primaryId: "b1",
    });

    await user.click(screen.getByRole("combobox"));
    // When popover is open, labels appear in both badges and dropdown.
    const options = screen.getAllByText("Alpha Board");
    const dropdownOption = options.find((el) => el.closest("[cmdk-item]"));
    await user.click(dropdownOption ?? options[options.length - 1]);

    // Removing the primary board should trigger fallback to next
    expect(onSelectedChange).toHaveBeenCalledWith(["b2"]);
    expect(onPrimaryChange).toHaveBeenCalledWith("b2");
  });

  it("removes board via X button on badge", async () => {
    const user = userEvent.setup();
    const { onSelectedChange } = setup({
      selected: ["b1", "b2"],
      primaryId: "b1",
    });

    const removeButtons = screen.getAllByTitle("Remove board");
    // Remove Beta Board (second badge)
    await user.click(removeButtons[1]);

    expect(onSelectedChange).toHaveBeenCalledWith(["b1"]);
  });

  it("sets primary via star button on non-primary badge", async () => {
    const user = userEvent.setup();
    const { onPrimaryChange } = setup({
      selected: ["b1", "b2"],
      primaryId: "b1",
    });

    const starButtons = screen.getAllByTitle("Set as primary board");
    await user.click(starButtons[0]);

    expect(onPrimaryChange).toHaveBeenCalledWith("b2");
  });

  it("disables combobox when disabled prop is true", () => {
    setup({ disabled: true });
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("does not auto-set primary when one already exists", async () => {
    const user = userEvent.setup();
    const { onPrimaryChange } = setup({
      selected: ["b1"],
      primaryId: "b1",
    });

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Beta Board"));

    // primary already set, should not be called
    expect(onPrimaryChange).not.toHaveBeenCalled();
  });

  it("shows hint text about primary when multiple boards selected", () => {
    setup({ selected: ["b1", "b2"], primaryId: "b1" });
    expect(screen.getByText(/primary board/i)).toBeInTheDocument();
  });
});

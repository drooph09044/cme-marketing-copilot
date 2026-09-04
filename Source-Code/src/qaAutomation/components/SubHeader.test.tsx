import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SubHeader from "./SubHeader";
import type { Journey, Segment } from "../lib/types";

const journey: Journey = {
  id: "j1",
  name: "Renewal",
  status: "Live",
  version: 1,
  updated: "x",
  owner: "x",
  nodes: [],
  edges: [],
  holdouts: [],
  suppression: [],
  criteria: [],
};

const journeys = [
  { id: "j1", name: "Renewal", status: "Live", version: 1, updated: "x", owner: "x" },
];

const segments: Segment[] = [
  {
    id: "s1", name: "High LTV", purpose: "test", size: "1K", refresh: "Daily",
    exclusions: "None", status: "Draft", rules: [], isPreset: false,
  },
  {
    id: "s2", name: "Low engagement", purpose: "test", size: "2K", refresh: "Daily",
    exclusions: "None", status: "Draft", rules: [], isPreset: false,
  },
];

const defaultProps = {
  journey,
  journeys,
  onSelectJourney: () => {},
  segments,
  selectedSegmentId: null as string | null,
  onSegmentChange: vi.fn(),
  qaRunning: false,
  synthRunning: false,
  onGenerateAndRun: vi.fn(),
  canSynth: false,
  hasSuites: false,
};

describe("SubHeader", () => {
  it("renders the segment dropdown and propagates changes", async () => {
    const onSegmentChange = vi.fn();
    render(<SubHeader {...defaultProps} onSegmentChange={onSegmentChange} />);

    const segmentSelect = screen.getByLabelText(/segment/i) as HTMLSelectElement;
    await userEvent.selectOptions(segmentSelect, "s2");
    expect(onSegmentChange).toHaveBeenCalledWith("s2");
  });

  it("shows Generate & Run QA when no suites exist", () => {
    render(<SubHeader {...defaultProps} canSynth={true} hasSuites={false} />);
    expect(screen.getByRole("button", { name: /generate & run qa/i })).toBeInTheDocument();
  });

  it("shows Run QA when suites already exist", () => {
    render(<SubHeader {...defaultProps} canSynth={true} hasSuites={true} />);
    expect(screen.getByRole("button", { name: /^run qa$/i })).toBeInTheDocument();
  });

  it("disables the button when canSynth is false", () => {
    render(<SubHeader {...defaultProps} canSynth={false} />);
    expect(screen.getByRole("button", { name: /generate & run qa/i })).toBeDisabled();
  });
});

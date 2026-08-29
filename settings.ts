import { App, TFile } from "obsidian";

export type DisplayMode = "bar" | "block";
export type ViewMode = "month" | "week";

export interface ColorRule {
  id: string;
  color: string;
  property: "tags" | "priority" | "description";
  keyword: string;
  enabled: boolean;
  displayMode: DisplayMode;
}

export interface FilterRule {
  id: string;
  property: "tags" | "priority" | "description";
  keyword: string;
  enabled: boolean;
}

export interface TaskQueryPath {
  id: string;
  path: string; // folder path, empty means root
  enabled: boolean;
}

export interface TaskCalendarSettings {
  colorRules: ColorRule[];
  filterRules: FilterRule[];
  queryPaths: TaskQueryPath[];
}

export const DEFAULT_SETTINGS: TaskCalendarSettings = {
  colorRules: [],
  filterRules: [],
  queryPaths: [
    { id: "default", path: "", enabled: true },
  ],
};

export const PRESET_COLORS = [
  "#e6194b", "#f58231", "#ffe119", "#bfef45",
  "#3cb44b", "#42d4f4", "#4363d8", "#911eb4",
  "#f032e6", "#a9a9a9", "#fabed4", "#ffd8b1",
  "#fffac8", "#aaffc3", "#e6beff", "#808000",
  "#ffcccc", "#ffe0b2", "#fff9c4", "#c8e6c9",
];

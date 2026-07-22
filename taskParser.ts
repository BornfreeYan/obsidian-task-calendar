import { App, TFile } from "obsidian";

export type TaskPriority = "none" | "low" | "medium" | "high";

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  filePath: string;
  lineNumber: number;
  startDate?: string; // 🛫
  dueDate?: string;   // 📅
  priority: TaskPriority;
  tags: string[];
  rawText: string;
}

/**
 * Parse all tasks from files under the specified paths.
 */
export async function getAllTasks(
  app: App,
  queryPaths: { path: string; enabled: boolean }[]
): Promise<Task[]> {
  const files = getQueryFiles(app, queryPaths);
  const tasks: Task[] = [];

  for (const file of files) {
    const content = await app.vault.read(file);
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parsed = parseTaskLine(line, file.path, i);
      if (parsed) {
        tasks.push(parsed);
      }
    }
  }

  return tasks;
}

function getQueryFiles(
  app: App,
  queryPaths: { path: string; enabled: boolean }[]
): TFile[] {
  const enabledPaths = queryPaths.filter((p) => p.enabled).map((p) => p.path);
  if (enabledPaths.length === 0) return app.vault.getMarkdownFiles();

  const allFiles = app.vault.getMarkdownFiles();
  const result: TFile[] = [];

  for (const file of allFiles) {
    for (const qp of enabledPaths) {
      if (qp === "") {
        result.push(file);
        break;
      }
      const prefix = qp.endsWith("/") ? qp : qp + "/";
      if (file.path === qp || file.path.startsWith(prefix)) {
        result.push(file);
        break;
      }
    }
  }

  return result;
}

/**
 * Parse a single line as a task. Returns null if not a task line.
 */
export function parseTaskLine(
  line: string,
  filePath: string,
  lineNumber: number
): Task | null {
  // Match: `- [ ] description` or `- [x] description`
  const taskMatch = line.match(/^\s*-\s*\[([ xX])\]\s+(.*)$/);
  if (!taskMatch) return null;

  const completed = taskMatch[1].toLowerCase() === "x";
  const rest = taskMatch[2];

  // Extract dates
  const startDate = extractDate(rest, "🛫");
  const dueDate = extractDate(rest, "📅");

  // If no dates at all, skip (user requirement: every task must have at least a start date)
  if (!startDate && !dueDate) return null;

  // If only one date exists, treat it as both start and due (single-day task)
  const finalStart = startDate || dueDate;
  const finalDue = dueDate || startDate;

  // Extract priority
  const priority = extractPriority(rest);

  // Extract tags
  const tags = extractTags(rest);

  // Clean description: remove date markers, priority, tags for display text
  let description = cleanDescription(rest);

  return {
    id: `${filePath}#${lineNumber}`,
    description,
    completed,
    filePath,
    lineNumber,
    startDate: finalStart,
    dueDate: finalDue,
    priority,
    tags,
    rawText: line,
  };
}

function extractDate(text: string, emoji: string): string | undefined {
  // Match emoji followed by optional space and date in format YYYY-MM-DD
  const regex = new RegExp(
    `${escapeRegex(emoji)}\\s*(\\d{4}-\\d{2}-\\d{2})`
  );
  const match = text.match(regex);
  if (match) {
    const dateStr = match[1];
    // Validate date
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return dateStr;
    }
  }
  return undefined;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPriority(text: string): TaskPriority {
  const match = text.match(/❗{1,3}/);
  if (!match) return "none";
  const count = match[0].length;
  if (count >= 3) return "high";
  if (count === 2) return "medium";
  return "low";
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  // Obsidian tag format: #tag or #multi-word-tag
  const regex = /#([\w-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tags.push(match[1]);
  }
  return tags;
}

function cleanDescription(text: string): string {
  let desc = text;
  // Remove date markers with their dates
  desc = desc.replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, "");
  desc = desc.replace(/📅\s*\d{4}-\d{2}-\d{2}/g, "");
  desc = desc.replace(/⏳\s*\d{4}-\d{2}-\d{2}/g, "");
  desc = desc.replace(/✅\s*\d{4}-\d{2}-\d{2}/g, "");
  // Remove priority markers
  desc = desc.replace(/❗{1,3}/g, "");
  // Remove tags
  desc = desc.replace(/#[\w-]+/g, "");
  // Clean up extra spaces
  desc = desc.trim().replace(/\s+/g, " ");
  return desc;
}

/**
 * Group tasks by a single date (for calendar views).
 * A task appears on each day within its [startDate, dueDate] range.
 */
export function groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!task.startDate) continue;
    const start = task.startDate;
    const end = task.dueDate || start;

    const dates = getDateRange(start, end);
    for (const dateStr of dates) {
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(task);
    }
  }

  return map;
}

/**
 * Get all dates in range [start, end] inclusive.
 */
function getDateRange(start: string, end: string): string[] {
  const result: string[] = [];
  const s = new Date(start);
  const e = new Date(end);

  // Ensure s <= e
  if (s > e) {
    return [start];
  }

  const current = new Date(s);
  while (current <= e) {
    result.push(formatDateStr(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Check if a task matches a date (within its range).
 */
export function taskCoversDate(task: Task, dateStr: string): boolean {
  if (!task.startDate) return false;
  const start = task.startDate;
  const end = task.dueDate || start;
  return dateStr >= start && dateStr <= end;
}

/**
 * Check if a task spans multiple days.
 */
export function isMultiDayTask(task: Task): boolean {
  if (!task.startDate || !task.dueDate) return false;
  return task.startDate !== task.dueDate;
}

/**
 * Update task dates in the original file.
 */
export async function updateTaskDates(
  app: App,
  task: Task,
  newStartDate: string,
  newDueDate: string
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(task.filePath);
  if (!(file instanceof TFile)) return;

  const content = await app.vault.read(file);
  const lines = content.split("\n");

  if (task.lineNumber < 0 || task.lineNumber >= lines.length) return;

  let line = lines[task.lineNumber];

  // Replace or add start date (🛫)
  if (line.includes("🛫")) {
    line = line.replace(/🛫\s*\d{4}-\d{2}-\d{2}/, `🛫 ${newStartDate}`);
  } else {
    line += ` 🛫 ${newStartDate}`;
  }

  // Replace or add due date (📅)
  if (line.includes("📅")) {
    line = line.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${newDueDate}`);
  } else {
    line += ` 📅 ${newDueDate}`;
  }

  lines[task.lineNumber] = line;
  await app.vault.modify(file, lines.join("\n"));
}

/**
 * Shift both dates by a number of days.
 */
export function shiftTaskDates(
  task: Task,
  days: number
): { startDate: string; dueDate: string } {
  const newStart = addDays(task.startDate || "", days);
  const newDue = addDays(task.dueDate || task.startDate || "", days);
  return { startDate: newStart, dueDate: newDue };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
}

import type { PrintDoc } from "./print";
import type { AgriStore } from "./store";
import type { Row } from "./types";

/** Move to another screen. `openNew` opens its "new" form; `prefill` fills that form in. */
export type Go = (moduleId: string, openNew?: boolean, prefill?: Record<string, unknown>) => void;

/** Things any screen can ask the shell to show on top of the page. */
export interface Ui {
  /** One document, or several that print one after another (for example a split bill). */
  print: (doc: PrintDoc | PrintDoc[]) => void;
  confirm: (options: { title: string; body: string; action: string; danger?: boolean; onConfirm: () => void }) => void;
  history: (row: Row, title: string) => void;
}

export interface ScreenProps {
  api: AgriStore;
  go: Go;
  notify: (message: string) => void;
  ui: Ui;
  /** Values handed over by the screen that sent the user here. */
  prefill?: Record<string, unknown>;
}

export type FieldNoteId =
  | "temple-gate"
  | "dome-chronoglass"
  | "observatory-sightline"
  | "radio-array-listening"
  | "talking-stone-statue";
export type FieldNotePageId = FieldNoteId | "arrival";

export type FieldNoteDefinition = {
  id: FieldNotePageId;
  index: number;
  body: string;
};

export type DiscoverableFieldNoteDefinition = {
  id: FieldNoteId;
  body: string;
};

export type FieldNoteEntry = FieldNoteDefinition & {
  id: FieldNoteId;
  discoveredAt: number;
};

export type FieldNotesSnapshot = {
  total: number;
  discoveredCount: number;
  discovered: FieldNoteEntry[];
  latest: FieldNoteEntry | null;
  current: FieldNoteDefinition | FieldNoteEntry;
};

export const INITIAL_FIELD_NOTE: FieldNoteDefinition = {
  id: "arrival",
  index: 1,
  body:
    "Unknown planet. Thin air. Singing mineral flora, glassy spring water. WASD to walk, Shift to run, Space to jump, Ctrl/C to crouch, hold R while still to sleep. Click the planet view once to lock mouse-look, click again or press Esc to free the cursor. Add ?demo=pr for the deterministic PR flythrough.",
};

export const FIELD_NOTE_DEFINITIONS: DiscoverableFieldNoteDefinition[] = [
  {
    id: "temple-gate",
    body: "Gate in the violet stone. The ring is broken, but the air inside it keeps a second colour. The planet leans toward it.",
  },
  {
    id: "dome-chronoglass",
    body: "Glass weather over bare ground. Inside the dome, daylight hurries across the sky as if the planet is remembering faster.",
  },
  {
    id: "observatory-sightline",
    body: "A little telescope on a quiet rim. Its lens catches the old sky and makes the far colours feel close enough to touch.",
  },
  {
    id: "radio-array-listening",
    body: "Three pale dishes listen in different directions. Their shadows overlap, but the silence they catch arrives one breath apart.",
  },
  {
    id: "talking-stone-statue",
    body: "The long-faced stone opens one eye. \"Tiny walker. I was ignoring you on purpose.\"",
  },
];

export type FieldNotesState = {
  discover: (id: FieldNoteId, elapsed: number) => boolean;
  hasDiscovered: (id: FieldNoteId) => boolean;
  getSnapshot: () => FieldNotesSnapshot;
};

export type FieldNotesHud = {
  refresh: () => void;
};

export function createFieldNotesState(definitions = FIELD_NOTE_DEFINITIONS): FieldNotesState {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const discovered = new Map<FieldNoteId, FieldNoteEntry>();

  return {
    discover: (id, elapsed) => {
      const definition = byId.get(id);
      if (!definition || discovered.has(id)) return false;
      discovered.set(id, { ...definition, index: discovered.size + 2, discoveredAt: elapsed });
      return true;
    },
    hasDiscovered: (id) => discovered.has(id),
    getSnapshot: () => {
      const entries = Array.from(discovered.values()).sort((a, b) => a.index - b.index);
      const latest = entries.reduce<FieldNoteEntry | null>((newest, entry) => {
        if (!newest || entry.discoveredAt > newest.discoveredAt) return entry;
        return newest;
      }, null);

      return {
        total: definitions.length + 1,
        discoveredCount: entries.length,
        discovered: entries,
        latest,
        current: latest ?? INITIAL_FIELD_NOTE,
      };
    },
  };
}

export function createFieldNotesHud(heading: HTMLElement, body: HTMLElement, state: FieldNotesState): FieldNotesHud {
  const refresh = (): void => {
    const snapshot = state.getSnapshot();
    heading.textContent = `Field Note ${snapshot.current.index.toString().padStart(3, "0")}`;
    body.textContent = snapshot.current.body;
  };

  refresh();
  return { refresh };
}

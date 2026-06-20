export type FieldNoteId = "temple-gate";

export type FieldNoteDefinition = {
  id: FieldNoteId;
  index: number;
  title: string;
  body: string;
};

export type FieldNoteEntry = FieldNoteDefinition & {
  discoveredAt: number;
};

export type FieldNotesSnapshot = {
  total: number;
  discoveredCount: number;
  discovered: FieldNoteEntry[];
  latest: FieldNoteEntry | null;
};

export const FIELD_NOTE_DEFINITIONS: FieldNoteDefinition[] = [
  {
    id: "temple-gate",
    index: 1,
    title: "Gate in the violet stone",
    body: "The ring is broken, but the air inside it keeps a second colour. The planet leans toward it.",
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
      discovered.set(id, { ...definition, discoveredAt: elapsed });
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
        total: definitions.length,
        discoveredCount: entries.length,
        discovered: entries,
        latest,
      };
    },
  };
}

export function createFieldNotesHud(container: HTMLElement, state: FieldNotesState): FieldNotesHud {
  const status = document.createElement("div");
  status.className = "hud__notes-status";

  const body = document.createElement("p");
  body.className = "hud__notes-body";

  container.replaceChildren(status, body);

  const refresh = (): void => {
    const snapshot = state.getSnapshot();
    status.textContent = `${snapshot.discoveredCount.toString().padStart(3, "0")} / ${snapshot.total
      .toString()
      .padStart(3, "0")} recovered`;
    container.dataset.state = snapshot.latest ? "discovered" : "empty";

    if (!snapshot.latest) {
      body.textContent = "No fragments recovered.";
      return;
    }

    body.textContent = `${snapshot.latest.index.toString().padStart(3, "0")} ${snapshot.latest.title}: ${snapshot.latest.body}`;
  };

  refresh();
  return { refresh };
}

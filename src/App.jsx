import React, { useState } from "react";

// ---------------------------------------------------------------------------
// PRESET BRICKS
// Static lookup for one-tap logging of foods eaten constantly.
// Kept outside the component so it isn't recreated on every render.
// ---------------------------------------------------------------------------
const PRESETS = [
  { name: "3 Eggs", protein: 18, calories: 210 },
  { name: "100g Paneer", protein: 18, calories: 300 },
];

export default function FitnessTracker() {
  // -------------------------------------------------------------------------
  // STATE
  // logs: single source of truth for every food entry. Each entry is an
  // independent object — never mutated in place, always replaced via
  // setLogs([...]) so React detects the change.
  // -------------------------------------------------------------------------
  const [logs, setLogs] = useState([]);

  // targetProtein: the user's editable daily goal (grams). Lives in its own
  // state slice because it changes independently of the log list.
  const [targetProtein, setTargetProtein] = useState(150);

  // Local form state for the manual "add food" inputs only.
  const [form, setForm] = useState({ name: "", protein: "", calories: "" });

  // Tracks whether the goal input is in "edit" mode vs static display.
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(targetProtein);

  // -------------------------------------------------------------------------
  // DERIVED TOTALS — no dedicated state, recalculated every render via
  // reduce(). This guarantees totals can never drift out of sync with logs.
  // -------------------------------------------------------------------------
  const totalProtein = logs.reduce((sum, entry) => sum + entry.protein, 0);
  const totalCalories = logs.reduce((sum, entry) => sum + entry.calories, 0);
  const progressPct = Math.min(100, (totalProtein / targetProtein) * 100 || 0);

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  // Appends one new log entry. Uses Date.now() + a random suffix as a
  // collision-safe unique id, spreading the previous array so we never
  // mutate state directly.
  const addLog = (entry) => {
    setLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...entry },
    ]);
  };

  // Quick-add: presets map straight onto addLog, no typing required.
  const handlePresetClick = (preset) => {
    addLog({ name: preset.name, protein: preset.protein, calories: preset.calories });
  };

  // Manual form submit: validates, builds the entry, resets the form.
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.protein === "" || form.calories === "") return;
    addLog({
      name: form.name.trim(),
      protein: Number(form.protein),
      calories: Number(form.calories),
    });
    setForm({ name: "", protein: "", calories: "" });
  };

  // Delete: filter() rebuilds the array excluding the matching id — the
  // removed item is never mutated, just excluded from the new array.
  const handleDelete = (id) => {
    setLogs((prev) => prev.filter((entry) => entry.id !== id));
  };

  // Commits the goal draft back into targetProtein and exits edit mode.
  const handleGoalSave = () => {
    const next = Number(goalDraft);
    if (!Number.isNaN(next) && next > 0) {
      setTargetProtein(next);
    }
    setEditingGoal(false);
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <div style={styles.page}>
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes flicker {
          0%, 97%, 100% { opacity: 1; }
          98% { opacity: 0.82; }
          99% { opacity: 0.95; }
        }
        .ft-input::placeholder { color: #5a6472; }
        .ft-input:focus { outline: none; border-color: #00f0ff !important; box-shadow: 0 0 12px rgba(0,240,255,0.35); }
        .ft-btn-cyan:hover { background: #00f0ff; color: #0d0e12; box-shadow: 0 0 18px rgba(0,240,255,0.55); }
        .ft-btn-lime:hover { background: #39ff14; color: #0d0e12; box-shadow: 0 0 18px rgba(57,255,20,0.55); }
        .ft-preset:hover { border-color: #39ff14; transform: translateY(-2px); box-shadow: 0 4px 16px rgba(57,255,20,0.25); }
        .ft-row:hover { background: rgba(0,240,255,0.05); }
        .ft-del:hover { background: #ff2a4d; color: #0d0e12; border-color: #ff2a4d; }
      `}</style>

      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.scanlineWrap}>
          <div style={styles.scanline} />
        </div>
        <h1 style={styles.title}>
          MACRO<span style={{ color: "#00f0ff" }}>//</span>GRID
        </h1>
        <p style={styles.subtitle}>SMART FITNESS &amp; NUTRITION TRACKER — DAILY UPLINK</p>
      </div>

      <div style={styles.grid}>
        {/* LEFT COLUMN: presets, form, goal, progress */}
        <div style={styles.col}>
          {/* QUICK-ADD PRESETS */}
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>⚡ QUICK-ADD BRICKS</h2>
            <div style={styles.presetGrid}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  className="ft-preset"
                  onClick={() => handlePresetClick(preset)}
                  style={styles.presetBtn}
                >
                  <span style={styles.presetName}>{preset.name}</span>
                  <span style={styles.presetMeta}>
                    <span style={{ color: "#39ff14" }}>{preset.protein}g</span> protein ·{" "}
                    <span style={{ color: "#00f0ff" }}>{preset.calories}</span> cal
                  </span>
                  <span style={styles.presetAdd}>+ ADD</span>
                </button>
              ))}
            </div>
          </section>

          {/* MANUAL ENTRY FORM */}
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>＋ LOG FOOD MANUALLY</h2>
            <form onSubmit={handleFormSubmit} style={styles.form}>
              <input
                className="ft-input"
                style={styles.input}
                type="text"
                placeholder="Food name (e.g. Grilled Chicken)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div style={styles.formRow}>
                <input
                  className="ft-input"
                  style={styles.input}
                  type="number"
                  min="0"
                  placeholder="Protein (g)"
                  value={form.protein}
                  onChange={(e) => setForm({ ...form, protein: e.target.value })}
                />
                <input
                  className="ft-input"
                  style={styles.input}
                  type="number"
                  min="0"
                  placeholder="Calories"
                  value={form.calories}
                  onChange={(e) => setForm({ ...form, calories: e.target.value })}
                />
              </div>
              <button type="submit" className="ft-btn-cyan" style={styles.cyanBtn}>
                LOG ENTRY →
              </button>
            </form>
          </section>

          {/* GOAL + PROGRESS */}
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>🎯 DAILY PROTEIN TARGET</h2>

            {editingGoal ? (
              <div style={styles.formRow}>
                <input
                  className="ft-input"
                  style={styles.input}
                  type="number"
                  min="1"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  autoFocus
                />
                <button className="ft-btn-lime" style={styles.limeBtnSm} onClick={handleGoalSave}>
                  SAVE
                </button>
              </div>
            ) : (
              <div style={styles.goalDisplayRow}>
                <span style={styles.goalValue}>{targetProtein}g target</span>
                <button
                  className="ft-btn-cyan"
                  style={styles.editBtn}
                  onClick={() => {
                    setGoalDraft(targetProtein);
                    setEditingGoal(true);
                  }}
                >
                  EDIT
                </button>
              </div>
            )}

            {/* PROGRESS BAR */}
            <div style={styles.progressOuter}>
              <div
                style={{
                  ...styles.progressInner,
                  width: `${progressPct}%`,
                }}
              />
              <span style={styles.progressLabel}>
                {totalProtein}g / {targetProtein}g ({Math.round(progressPct)}%)
              </span>
            </div>

            <div style={styles.statsRow}>
              <div style={styles.statBox}>
                <span style={styles.statLabel}>TOTAL PROTEIN</span>
                <span style={{ ...styles.statValue, color: "#39ff14" }}>{totalProtein}g</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statLabel}>TOTAL CALORIES</span>
                <span style={{ ...styles.statValue, color: "#00f0ff" }}>{totalCalories}</span>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: log history */}
        <div style={styles.col}>
          <section style={{ ...styles.panel, flex: 1 }}>
            <h2 style={styles.panelTitle}>📋 LOG HISTORY ({logs.length})</h2>

            {logs.length === 0 ? (
              <div style={styles.emptyState}>
                NO ENTRIES YET. ADD A PRESET OR LOG SOMETHING TO START TRACKING.
              </div>
            ) : (
              <div style={styles.logList}>
                {/* .map() renders each entry; id is the stable, unique key */}
                {logs.map((entry) => (
                  <div key={entry.id} className="ft-row" style={styles.logRow}>
                    <div style={styles.logInfo}>
                      <span style={styles.logName}>{entry.name}</span>
                      <span style={styles.logMeta}>
                        <span style={{ color: "#39ff14" }}>{entry.protein}g</span> protein ·{" "}
                        <span style={{ color: "#00f0ff" }}>{entry.calories}</span> cal
                      </span>
                    </div>
                    <button
                      className="ft-del"
                      style={styles.deleteBtn}
                      onClick={() => handleDelete(entry.id)}
                      aria-label={`Delete ${entry.name}`}
                    >
                      ✕ DELETE
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STYLES — all inline / object-based, self-contained, dark cyberpunk theme.
// ---------------------------------------------------------------------------
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(ellipse at top, #161920 0%, #0d0e12 60%)",
    color: "#e6f1f5",
    fontFamily:
      "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
    padding: "32px 20px 60px",
    boxSizing: "border-box",
  },
  header: {
    position: "relative",
    textAlign: "center",
    marginBottom: "32px",
    overflow: "hidden",
    padding: "16px 0",
    animation: "flicker 6s infinite",
  },
  scanlineWrap: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    opacity: 0.25,
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: "40%",
    background:
      "linear-gradient(to bottom, transparent, rgba(0,240,255,0.25), transparent)",
    animation: "scanline 5s linear infinite",
  },
  title: {
    fontSize: "2.4rem",
    fontWeight: 800,
    letterSpacing: "0.08em",
    margin: 0,
    color: "#39ff14",
    textShadow: "0 0 18px rgba(57,255,20,0.45)",
  },
  subtitle: {
    marginTop: "8px",
    fontSize: "0.8rem",
    letterSpacing: "0.25em",
    color: "#6f7a87",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
    gap: "24px",
    maxWidth: "1100px",
    margin: "0 auto",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  panel: {
    background: "#161920",
    border: "1px solid #262b34",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 0 0 1px rgba(0,240,255,0.04) inset",
  },
  panelTitle: {
    margin: "0 0 16px",
    fontSize: "0.95rem",
    letterSpacing: "0.12em",
    color: "#00f0ff",
    textTransform: "uppercase",
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  presetBtn: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    borderRadius: "8px",
    padding: "14px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    color: "#e6f1f5",
  },
  presetName: {
    fontWeight: 700,
    fontSize: "0.9rem",
  },
  presetMeta: {
    fontSize: "0.75rem",
    color: "#9aa6b2",
  },
  presetAdd: {
    marginTop: "6px",
    fontSize: "0.7rem",
    letterSpacing: "0.1em",
    color: "#39ff14",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  formRow: {
    display: "flex",
    gap: "12px",
  },
  input: {
    flex: 1,
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    borderRadius: "6px",
    padding: "10px 12px",
    color: "#e6f1f5",
    fontSize: "0.85rem",
    fontFamily: "inherit",
    transition: "border-color 0.15s ease",
    minWidth: 0,
  },
  cyanBtn: {
    background: "transparent",
    border: "1px solid #00f0ff",
    color: "#00f0ff",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "0.85rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  limeBtnSm: {
    background: "transparent",
    border: "1px solid #39ff14",
    color: "#39ff14",
    borderRadius: "6px",
    padding: "0 18px",
    fontSize: "0.8rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  editBtn: {
    background: "transparent",
    border: "1px solid #00f0ff",
    color: "#00f0ff",
    borderRadius: "6px",
    padding: "6px 14px",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  goalDisplayRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
  },
  goalValue: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#e6f1f5",
  },
  progressOuter: {
    position: "relative",
    height: "26px",
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    borderRadius: "999px",
    overflow: "hidden",
    marginTop: "4px",
  },
  progressInner: {
    height: "100%",
    background: "linear-gradient(90deg, #00f0ff, #39ff14)",
    boxShadow: "0 0 14px rgba(57,255,20,0.6)",
    transition: "width 0.4s ease",
  },
  progressLabel: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.72rem",
    fontWeight: 700,
    color: "#0d0e12",
    mixBlendMode: "difference",
    filter: "invert(1) grayscale(1) contrast(2)",
  },
  statsRow: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
  },
  statBox: {
    flex: 1,
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    borderRadius: "8px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statLabel: {
    fontSize: "0.65rem",
    letterSpacing: "0.1em",
    color: "#6f7a87",
  },
  statValue: {
    fontSize: "1.3rem",
    fontWeight: 800,
  },
  emptyState: {
    border: "1px dashed #2a2f38",
    borderRadius: "8px",
    padding: "32px 16px",
    textAlign: "center",
    fontSize: "0.78rem",
    color: "#5a6472",
    letterSpacing: "0.04em",
  },
  logList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxHeight: "480px",
    overflowY: "auto",
  },
  logRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    borderRadius: "8px",
    padding: "12px 14px",
    transition: "background 0.15s ease",
    gap: "12px",
  },
  logInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },
  logName: {
    fontWeight: 700,
    fontSize: "0.88rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  logMeta: {
    fontSize: "0.72rem",
    color: "#9aa6b2",
  },
  deleteBtn: {
    background: "transparent",
    border: "1px solid #3a2228",
    color: "#ff2a4d",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  },
};
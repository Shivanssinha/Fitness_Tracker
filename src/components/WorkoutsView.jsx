import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function WorkoutsView({ user, onWorkoutLogged }) {
  const [exercises, setExercises] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Form State
  const [workoutDate, setWorkoutDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [title, setTitle] = useState("Push Session");
  const [notes, setNotes] = useState("");
  const [sets, setSets] = useState([
    { exercise_id: 1, set_number: 1, reps: 10, weight_kg: 80.0 },
    { exercise_id: 1, set_number: 2, reps: 8, weight_kg: 85.0 },
    { exercise_id: 1, set_number: 3, reps: 6, weight_kg: 90.0 },
  ]);

  useEffect(() => {
    loadExercises();
    if (user) {
      loadWorkouts();
    }
  }, [user]);

  const loadExercises = async () => {
    try {
      const data = await api.getExercises();
      setExercises(data);
      if (data.length > 0 && sets[0].exercise_id === 1) {
        setSets((prev) =>
          prev.map((s) => ({ ...s, exercise_id: data[0].id }))
        );
      }
    } catch (err) {
      console.error("Failed to load exercises:", err);
    }
  };

  const loadWorkouts = async () => {
    setLoading(true);
    try {
      const data = await api.getWorkouts();
      setWorkouts(data);
    } catch (err) {
      console.error("Failed to load workouts:", err);
    } finally {
      setLoading(false);
    }
  };

  // Set builder handlers
  const handleAddSet = () => {
    const lastSet = sets[sets.length - 1];
    setSets((prev) => [
      ...prev,
      {
        exercise_id: lastSet ? lastSet.exercise_id : exercises[0]?.id || 1,
        set_number: prev.length + 1,
        reps: lastSet ? lastSet.reps : 10,
        weight_kg: lastSet ? lastSet.weight_kg : 60,
      },
    ]);
  };

  const handleRemoveSet = (index) => {
    if (sets.length === 1) return;
    const updated = sets.filter((_, idx) => idx !== index);
    // Re-index set_number
    const reindexed = updated.map((s, idx) => ({ ...s, set_number: idx + 1 }));
    setSets(reindexed);
  };

  const handleSetChange = (index, field, value) => {
    setSets((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value,
      };
      return copy;
    });
  };

  // Submit Workout
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setFeedback({ type: "error", message: "Please log in to record a workout." });
      return;
    }

    if (sets.length === 0) {
      setFeedback({ type: "error", message: "Add at least one set to save." });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: "", message: "" });

    // Validate and format sets ensuring numbers
    const formattedSets = sets.map((s, idx) => ({
      exercise_id: Number(s.exercise_id) || (exercises[0]?.id || 1),
      set_number: idx + 1,
      reps: Math.max(1, parseInt(s.reps, 10) || 1),
      weight_kg: Math.max(0, parseFloat(s.weight_kg) || 0),
    }));

    try {
      await api.createWorkout({
        workout_date: workoutDate,
        title: title.trim(),
        notes: notes.trim() || null,
        sets: formattedSets,
      });

      setFeedback({
        type: "success",
        message: "Workout & sets committed successfully in a single atomic transaction!",
      });

      // Reload workouts and trigger dashboard refresh
      loadWorkouts();
      if (onWorkoutLogged) onWorkoutLogged();

      // Reset sets to clean default
      setSets([
        { exercise_id: exercises[0]?.id || 1, set_number: 1, reps: "10", weight_kg: "60" },
      ]);
      setNotes("");
    } catch (err) {
      setFeedback({
        type: "error",
        message: `Transaction Aborted: ${err.message}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Workout
  const handleDeleteWorkout = async (id) => {
    if (!window.confirm("Delete this workout session and all associated sets?")) return;
    try {
      await api.deleteWorkout(id);
      loadWorkouts();
      if (onWorkoutLogged) onWorkoutLogged();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const calculateTotalVolume = () => {
    return sets.reduce(
      (sum, s) => sum + (Number(s.reps) || 0) * (Number(s.weight_kg) || 0),
      0
    ).toFixed(1);
  };

  return (
    <div style={styles.grid}>
      {/* LEFT COLUMN: WORKOUT LOGGING FORM */}
      <div style={styles.col}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>＋ LOG WORKOUT SESSION</h2>
            <span style={styles.badge}>ACID TRANSACTION</span>
          </div>

          <p style={styles.subtext}>
            Saves the workout header and each set atomically. If any constraint fails, the entire transaction rolls back cleanly.
          </p>

          {feedback.message && (
            <div
              style={
                feedback.type === "success"
                  ? styles.successAlert
                  : styles.errorAlert
              }
            >
              {feedback.message}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.row}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>DATE</label>
                <input
                  type="date"
                  required
                  className="ft-input"
                  style={styles.input}
                  value={workoutDate}
                  onChange={(e) => setWorkoutDate(e.target.value)}
                />
              </div>
              <div style={{ ...styles.inputGroup, flex: 2 }}>
                <label style={styles.label}>SESSION TITLE</label>
                <input
                  type="text"
                  required
                  className="ft-input"
                  style={styles.input}
                  placeholder="e.g. Push Day A"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>NOTES (OPTIONAL)</label>
              <input
                type="text"
                className="ft-input"
                style={styles.input}
                placeholder="RPE 8.5, focused on pause reps..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* SETS BUILDER */}
            <div style={styles.setsSection}>
              <div style={styles.setsHeader}>
                <span style={styles.setsTitle}>WORKOUT SETS ({sets.length})</span>
                <span style={styles.estVolume}>
                  EST. VOLUME: <span style={{ color: "#39ff14" }}>{calculateTotalVolume()} kg</span>
                </span>
              </div>

              <div style={styles.setsList}>
                {sets.map((set, idx) => (
                  <div key={idx} style={styles.setRow}>
                    <span style={styles.setNumBadge}>#{set.set_number}</span>

                    <select
                      className="ft-input"
                      style={styles.exerciseSelect}
                      value={set.exercise_id}
                      onChange={(e) => handleSetChange(idx, "exercise_id", e.target.value)}
                    >
                      {exercises.length === 0 ? (
                        <option value="">Loading exercises catalog...</option>
                      ) : (
                        exercises.map((ex) => (
                          <option key={ex.id} value={ex.id} style={{ background: "#161920" }}>
                            [{ex.category}] {ex.name}
                          </option>
                        ))
                      )}
                    </select>

                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Reps"
                      className="ft-input"
                      style={styles.repInput}
                      value={set.reps}
                      onChange={(e) => handleSetChange(idx, "reps", e.target.value)}
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      placeholder="kg"
                      className="ft-input"
                      style={styles.weightInput}
                      value={set.weight_kg}
                      onChange={(e) => handleSetChange(idx, "weight_kg", e.target.value)}
                    />

                    <button
                      type="button"
                      className="ft-del"
                      style={styles.delSetBtn}
                      onClick={() => handleRemoveSet(idx)}
                      disabled={sets.length === 1}
                      title="Remove set"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="ft-btn-lime"
                style={styles.addSetBtn}
                onClick={handleAddSet}
              >
                ＋ ADD ANOTHER SET
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="ft-btn-cyan"
              style={styles.submitBtn}
            >
              {submitting ? "EXECUTING TRANSACTION..." : "⚡ COMMIT WORKOUT (TRANSACTION) →"}
            </button>
          </form>
        </section>
      </div>

      {/* RIGHT COLUMN: WORKOUT HISTORY */}
      <div style={styles.col}>
        <section style={{ ...styles.panel, flex: 1 }}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>
              📋 WORKOUT HISTORY ({workouts.length})
            </h2>
            <button
              className="ft-btn-cyan"
              style={styles.refreshBtn}
              onClick={loadWorkouts}
            >
              ↻ REFRESH
            </button>
          </div>

          {loading ? (
            <div style={styles.emptyState}>LOADING WORKOUTS FROM DATABASE...</div>
          ) : workouts.length === 0 ? (
            <div style={styles.emptyState}>
              NO WORKOUTS RECORDED YET. LOG YOUR FIRST SESSION OR SWITCH TO DEMOUSER.
            </div>
          ) : (
            <div style={styles.workoutList}>
              {workouts.map((w) => {
                const totalTonnage = w.sets.reduce(
                  (sum, s) => sum + s.reps * s.weight_kg,
                  0
                );
                return (
                  <div key={w.id} style={styles.workoutCard}>
                    <div style={styles.cardHeader}>
                      <div>
                        <span style={styles.workoutDate}>{w.workout_date}</span>
                        <h3 style={styles.workoutTitle}>{w.title}</h3>
                        {w.notes && <p style={styles.workoutNotes}>{w.notes}</p>}
                      </div>
                      <div style={styles.cardMetrics}>
                        <div style={styles.tonnageBox}>
                          <span style={styles.tonnageLabel}>VOLUME</span>
                          <span style={styles.tonnageVal}>{totalTonnage.toLocaleString()} kg</span>
                        </div>
                        <button
                          className="ft-del"
                          style={styles.delCardBtn}
                          onClick={() => handleDeleteWorkout(w.id)}
                          title="Delete workout"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Sets summary */}
                    <div style={styles.cardSetsTable}>
                      {w.sets.map((s) => (
                        <div key={s.id} style={styles.cardSetItem}>
                          <span style={styles.cardSetName}>
                            {s.exercise_name || `Ex #${s.exercise_id}`}
                          </span>
                          <span style={styles.cardSetSpec}>
                            Set {s.set_number}: <strong style={{ color: "#39ff14" }}>{s.weight_kg}kg</strong> × {s.reps} reps
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr",
    gap: "24px",
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
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  panelTitle: {
    margin: 0,
    fontSize: "0.95rem",
    letterSpacing: "0.12em",
    color: "#00f0ff",
    textTransform: "uppercase",
  },
  badge: {
    fontSize: "0.65rem",
    padding: "3px 8px",
    borderRadius: "4px",
    background: "rgba(57,255,20,0.1)",
    border: "1px solid #39ff14",
    color: "#39ff14",
    letterSpacing: "0.05em",
    fontWeight: 700,
  },
  subtext: {
    fontSize: "0.75rem",
    color: "#6f7a87",
    marginBottom: "16px",
    lineHeight: 1.4,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  row: {
    display: "flex",
    gap: "12px",
  },
  inputGroup: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    fontSize: "0.68rem",
    letterSpacing: "0.08em",
    color: "#9aa6b2",
  },
  input: {
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    borderRadius: "6px",
    padding: "9px 12px",
    color: "#e6f1f5",
    fontSize: "0.85rem",
    fontFamily: "inherit",
  },
  setsSection: {
    marginTop: "8px",
    background: "#0d0e12",
    border: "1px solid #262b34",
    borderRadius: "8px",
    padding: "14px",
  },
  setsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  setsTitle: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#00f0ff",
    letterSpacing: "0.08em",
  },
  estVolume: {
    fontSize: "0.72rem",
    color: "#9aa6b2",
  },
  setsList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "12px",
  },
  setRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  setNumBadge: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#6f7a87",
    width: "28px",
  },
  exerciseSelect: {
    flex: 2,
    background: "#161920",
    border: "1px solid #2a2f38",
    borderRadius: "6px",
    padding: "8px",
    color: "#e6f1f5",
    fontSize: "0.8rem",
    fontFamily: "inherit",
  },
  repInput: {
    width: "70px",
    background: "#161920",
    border: "1px solid #2a2f38",
    borderRadius: "6px",
    padding: "8px",
    color: "#e6f1f5",
    fontSize: "0.8rem",
    textAlign: "center",
  },
  weightInput: {
    width: "80px",
    background: "#161920",
    border: "1px solid #2a2f38",
    borderRadius: "6px",
    padding: "8px",
    color: "#e6f1f5",
    fontSize: "0.8rem",
    textAlign: "center",
  },
  delSetBtn: {
    background: "transparent",
    border: "1px solid #3a2228",
    color: "#ff2a4d",
    borderRadius: "4px",
    width: "28px",
    height: "32px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.75rem",
  },
  addSetBtn: {
    width: "100%",
    padding: "8px",
    background: "transparent",
    border: "1px dashed #39ff14",
    color: "#39ff14",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.06em",
  },
  submitBtn: {
    marginTop: "6px",
    background: "transparent",
    border: "1px solid #00f0ff",
    color: "#00f0ff",
    padding: "12px",
    borderRadius: "6px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  refreshBtn: {
    background: "transparent",
    border: "1px solid #2a2f38",
    color: "#00f0ff",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "0.7rem",
    cursor: "pointer",
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
  workoutList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    maxHeight: "560px",
    overflowY: "auto",
  },
  workoutCard: {
    background: "#0d0e12",
    border: "1px solid #262b34",
    borderRadius: "8px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  workoutDate: {
    fontSize: "0.7rem",
    color: "#6f7a87",
    letterSpacing: "0.06em",
  },
  workoutTitle: {
    margin: "2px 0 0",
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "#e6f1f5",
  },
  workoutNotes: {
    margin: "4px 0 0",
    fontSize: "0.72rem",
    color: "#9aa6b2",
    fontStyle: "italic",
  },
  cardMetrics: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  tonnageBox: {
    textAlign: "right",
  },
  tonnageLabel: {
    display: "block",
    fontSize: "0.6rem",
    color: "#6f7a87",
    letterSpacing: "0.08em",
  },
  tonnageVal: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#39ff14",
  },
  delCardBtn: {
    background: "transparent",
    border: "1px solid #3a2228",
    color: "#ff2a4d",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "0.65rem",
    cursor: "pointer",
  },
  cardSetsTable: {
    borderTop: "1px solid #1a1e26",
    paddingTop: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  cardSetItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.74rem",
    color: "#9aa6b2",
  },
  cardSetName: {
    color: "#e6f1f5",
  },
  cardSetSpec: {},
  successAlert: {
    background: "rgba(57,255,20,0.1)",
    border: "1px solid #39ff14",
    color: "#39ff14",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "0.75rem",
    marginBottom: "10px",
  },
  errorAlert: {
    background: "rgba(255,42,77,0.1)",
    border: "1px solid #ff2a4d",
    color: "#ff2a4d",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "0.75rem",
    marginBottom: "10px",
  },
};


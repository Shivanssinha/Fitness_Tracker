import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function GoalsView({ user, onGoalUpdated }) {
  const [streakData, setStreakData] = useState(null);
  const [goalsProgress, setGoalsProgress] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Goal Form State
  const [goalType, setGoalType] = useState("weekly_workouts");
  const [targetValue, setTargetValue] = useState("4");
  const [exerciseId, setExerciseId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [streak, goals, exList] = await Promise.all([
        api.getStreak(),
        api.getGoalsProgress(),
        api.getExercises(),
      ]);
      setStreakData(streak);
      setGoalsProgress(goals);
      setExercises(exList);
      if (exList.length > 0 && !exerciseId) {
        setExerciseId(exList[0].id);
      }
    } catch (err) {
      console.error("Failed to load goals data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback("");

    try {
      await api.createGoal({
        goal_type: goalType,
        target_value: parseFloat(targetValue),
        exercise_id: goalType === "exercise_weight" ? Number(exerciseId) : null,
        start_date: startDate,
        target_date: targetDate || null,
        status: "in_progress",
      });

      setFeedback("New goal successfully added!");
      loadData();
      if (onGoalUpdated) onGoalUpdated();
      setTargetValue("4");
    } catch (err) {
      setFeedback(`Failed to create goal: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm("Delete this fitness goal?")) return;
    try {
      await api.deleteGoal(goalId);
      loadData();
      if (onGoalUpdated) onGoalUpdated();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleToggleComplete = async (goal) => {
    const nextStatus = goal.status === "completed" ? "in_progress" : "completed";
    try {
      await api.updateGoal(goal.goal_id, { status: nextStatus });
      loadData();
      if (onGoalUpdated) onGoalUpdated();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  };

  return (
    <div style={styles.container}>
      {/* SECTION 1: WORKOUT STREAK (SQL GAPS & ISLANDS) */}
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>🔥 WORKOUT STREAKS &amp; FREQUENCY</h2>
            <span style={styles.sqlBadge}>
              SQL: GAPS AND ISLANDS WITH <code>ROW_NUMBER()</code> &amp; <code>DATE_SUB()</code>
            </span>
          </div>
        </div>

        <p style={styles.sqlExplainer}>
          Solves the classic SQL Gaps &amp; Islands problem: 
          <code>DATE_SUB(workout_date, INTERVAL ROW_NUMBER() OVER (ORDER BY workout_date) DAY) AS island_id</code>.
          Unbroken consecutive days maintain an identical <code>island_id</code>.
        </p>

        <div style={styles.streakGrid}>
          <div style={styles.streakBox}>
            <span style={styles.streakLabel}>ACTIVE STREAK</span>
            <span style={{ ...styles.streakVal, color: "#39ff14" }}>
              {streakData?.current_streak_days || 0}
              <span style={styles.unit}> DAYS</span>
            </span>
            <span style={styles.streakDesc}>Consecutive days</span>
          </div>

          <div style={styles.streakBox}>
            <span style={styles.streakLabel}>ALL-TIME LONGEST</span>
            <span style={{ ...styles.streakVal, color: "#00f0ff" }}>
              {streakData?.longest_streak_days || 0}
              <span style={styles.unit}> DAYS</span>
            </span>
            <span style={styles.streakDesc}>Peak consistency record</span>
          </div>

          <div style={styles.streakBox}>
            <span style={styles.streakLabel}>TOTAL WORKOUT DAYS</span>
            <span style={{ ...styles.streakVal, color: "#e6f1f5" }}>
              {streakData?.total_workout_days || 0}
              <span style={styles.unit}> SESSIONS</span>
            </span>
            <span style={styles.streakDesc}>Distinct calendar dates</span>
          </div>
        </div>
      </section>

      {/* SECTION 2: GOALS PROGRESS & SETTING */}
      <div style={styles.goalsGrid}>
        {/* LEFT: ACTIVE GOALS WITH DYNAMIC SQL PROGRESS */}
        <div style={styles.col}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>🎯 ACTIVE FITNESS GOALS ({goalsProgress.length})</h2>
              <span style={styles.sqlBadge}>
                SQL: CORRELATED SUBQUERIES + <code>CASE WHEN</code>
              </span>
            </div>

            <p style={styles.sqlExplainer}>
              Calculates live progress dynamically from historical sets and workout dates without redundant database storage.
            </p>

            {loading ? (
              <div style={styles.emptyNotice}>CALCULATING LIVE PROGRESS FROM DATABASE...</div>
            ) : goalsProgress.length === 0 ? (
              <div style={styles.emptyNotice}>NO ACTIVE GOALS. SET ONE TO START TRACKING!</div>
            ) : (
              <div style={styles.goalsList}>
                {goalsProgress.map((g) => {
                  const isDone = g.status === "completed" || g.progress_pct >= 100;
                  return (
                    <div key={g.goal_id} style={styles.goalCard}>
                      <div style={styles.goalTopRow}>
                        <div>
                          <span style={styles.goalTypeTag}>
                            {g.goal_type === "weekly_workouts"
                              ? "WEEKLY FREQUENCY"
                              : "1RM WEIGHT TARGET"}
                          </span>
                          <h3 style={styles.goalTitle}>
                            {g.goal_type === "weekly_workouts"
                              ? `${g.target_value} Workouts / Week`
                              : `${g.exercise_name || "Exercise"} @ ${g.target_value} kg`}
                          </h3>
                        </div>

                        <div style={styles.goalActions}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              borderColor: isDone ? "#39ff14" : "#00f0ff",
                              color: isDone ? "#39ff14" : "#00f0ff",
                            }}
                          >
                            {isDone ? "✓ COMPLETED" : "IN PROGRESS"}
                          </span>
                          <button
                            className="ft-del"
                            style={styles.delGoalBtn}
                            onClick={() => handleDeleteGoal(g.goal_id)}
                            title="Delete goal"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={styles.progressOuter}>
                        <div
                          style={{
                            ...styles.progressInner,
                            width: `${Math.min(100, g.progress_pct)}%`,
                            background: isDone
                              ? "#39ff14"
                              : "linear-gradient(90deg, #00f0ff, #39ff14)",
                          }}
                        />
                        <span style={styles.progressText}>
                          {g.current_value} / {g.target_value}{" "}
                          {g.goal_type === "exercise_weight" ? "kg" : "workouts"} ({g.progress_pct}%)
                        </span>
                      </div>

                      <div style={styles.goalMetaRow}>
                        <span>Started: {g.start_date}</span>
                        {g.target_date && <span>Target Date: {g.target_date}</span>}
                        <button
                          style={styles.toggleBtn}
                          onClick={() => handleToggleComplete(g)}
                        >
                          {g.status === "completed" ? "Mark In Progress" : "Mark as Completed"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: SET NEW GOAL FORM */}
        <div style={styles.col}>
          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>＋ CONFIGURE NEW GOAL</h2>
            <p style={styles.sqlExplainer}>
              Target weekly consistency or single-exercise maximum weight.
            </p>

            {feedback && <div style={styles.feedbackMsg}>{feedback}</div>}

            <form onSubmit={handleCreateGoal} style={styles.form}>
              <div style={styles.field}>
                <label style={styles.label}>GOAL TYPE</label>
                <select
                  className="ft-input"
                  style={styles.select}
                  value={goalType}
                  onChange={(e) => {
                    setGoalType(e.target.value);
                    if (e.target.value === "weekly_workouts") setTargetValue("4");
                    else setTargetValue("100");
                  }}
                >
                  <option value="weekly_workouts" style={{ background: "#161920" }}>
                    Weekly Workouts Frequency
                  </option>
                  <option value="exercise_weight" style={{ background: "#161920" }}>
                    Exercise Max Weight (PR Target)
                  </option>
                </select>
              </div>

              {goalType === "exercise_weight" && (
                <div style={styles.field}>
                  <label style={styles.label}>TARGET EXERCISE</label>
                  <select
                    className="ft-input"
                    style={styles.select}
                    value={exerciseId}
                    onChange={(e) => setExerciseId(e.target.value)}
                  >
                    {exercises.map((ex) => (
                      <option key={ex.id} value={ex.id} style={{ background: "#161920" }}>
                        [{ex.category}] {ex.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={styles.field}>
                <label style={styles.label}>
                  {goalType === "weekly_workouts"
                    ? "TARGET WORKOUTS PER WEEK"
                    : "TARGET WEIGHT (KG)"}
                </label>
                <input
                  type="number"
                  min="1"
                  step={goalType === "weekly_workouts" ? "1" : "2.5"}
                  required
                  className="ft-input"
                  style={styles.input}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                />
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>START DATE</label>
                  <input
                    type="date"
                    required
                    className="ft-input"
                    style={styles.input}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>TARGET DATE (OPTIONAL)</label>
                  <input
                    type="date"
                    className="ft-input"
                    style={styles.input}
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="ft-btn-cyan"
                style={styles.submitBtn}
              >
                {submitting ? "SAVING..." : "COMMIT GOAL TO DATABASE →"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
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
    marginBottom: "4px",
  },
  panelTitle: {
    margin: 0,
    fontSize: "0.95rem",
    letterSpacing: "0.1em",
    color: "#00f0ff",
    textTransform: "uppercase",
  },
  sqlBadge: {
    display: "inline-block",
    marginTop: "4px",
    fontSize: "0.62rem",
    letterSpacing: "0.06em",
    color: "#9aa6b2",
  },
  sqlExplainer: {
    margin: "4px 0 16px",
    fontSize: "0.72rem",
    color: "#6f7a87",
    lineHeight: 1.4,
  },
  streakGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
  },
  streakBox: {
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  streakLabel: {
    fontSize: "0.65rem",
    letterSpacing: "0.1em",
    color: "#6f7a87",
    textTransform: "uppercase",
  },
  streakVal: {
    fontSize: "1.8rem",
    fontWeight: 800,
    letterSpacing: "0.04em",
  },
  unit: {
    fontSize: "0.85rem",
    color: "#9aa6b2",
  },
  streakDesc: {
    fontSize: "0.68rem",
    color: "#5a6472",
  },
  goalsGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: "24px",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  goalsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  goalCard: {
    background: "#0d0e12",
    border: "1px solid #262b34",
    borderRadius: "8px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  goalTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  goalTypeTag: {
    fontSize: "0.62rem",
    color: "#6f7a87",
    letterSpacing: "0.06em",
  },
  goalTitle: {
    margin: "2px 0 0",
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "#e6f1f5",
  },
  goalActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  statusBadge: {
    fontSize: "0.62rem",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "4px",
    border: "1px solid",
    letterSpacing: "0.06em",
  },
  delGoalBtn: {
    background: "transparent",
    border: "1px solid #3a2228",
    color: "#ff2a4d",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "0.65rem",
    cursor: "pointer",
  },
  progressOuter: {
    position: "relative",
    height: "22px",
    background: "#161920",
    border: "1px solid #2a2f38",
    borderRadius: "999px",
    overflow: "hidden",
    marginTop: "2px",
  },
  progressInner: {
    height: "100%",
    transition: "width 0.4s ease",
  },
  progressText: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.68rem",
    fontWeight: 700,
    color: "#ffffff",
    textShadow: "0 0 4px #000",
  },
  goalMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.68rem",
    color: "#6f7a87",
    marginTop: "2px",
  },
  toggleBtn: {
    background: "transparent",
    border: "none",
    color: "#00f0ff",
    fontSize: "0.68rem",
    textDecoration: "underline",
    cursor: "pointer",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: 1,
  },
  row: {
    display: "flex",
    gap: "12px",
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
  select: {
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    borderRadius: "6px",
    padding: "9px 12px",
    color: "#e6f1f5",
    fontSize: "0.85rem",
    fontFamily: "inherit",
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
  },
  emptyNotice: {
    border: "1px dashed #2a2f38",
    borderRadius: "8px",
    padding: "32px",
    textAlign: "center",
    color: "#5a6472",
    fontSize: "0.78rem",
  },
  feedbackMsg: {
    background: "rgba(0,240,255,0.1)",
    border: "1px solid #00f0ff",
    color: "#00f0ff",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "0.75rem",
    marginBottom: "10px",
  },
};


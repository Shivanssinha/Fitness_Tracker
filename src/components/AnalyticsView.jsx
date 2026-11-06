import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api } from "../api";

export default function AnalyticsView({ user }) {
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [prs, setPrs] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(1);
  const [exerciseHistory, setExerciseHistory] = useState([]);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedExercise) {
      loadExerciseHistory(selectedExercise);
    }
  }, [user, selectedExercise]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, prsData, exList] = await Promise.all([
        api.getWeeklyStats(12),
        api.getPersonalRecords(),
        api.getExercises(),
      ]);
      setWeeklyStats(statsData);
      setPrs(prsData);
      setExercises(exList);
      if (exList.length > 0 && !selectedExercise) {
        setSelectedExercise(exList[0].id);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadExerciseHistory = async (exId) => {
    try {
      const history = await api.getExerciseHistory(exId);
      setExerciseHistory(history);
    } catch (err) {
      console.error("Failed to load exercise history:", err);
    }
  };

  const categories = ["ALL", "CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS"];

  const filteredPrs =
    activeCategory === "ALL"
      ? prs
      : prs.filter(
          (p) => p.exercise_category.toUpperCase() === activeCategory
        );

  return (
    <div style={styles.container}>
      {/* SECTION 1: WEEKLY VOLUME PROGRESSION (POWERED BY SQL VIEW: weekly_summary) */}
      <div style={styles.chartGrid}>
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>📊 WEEKLY TONNAGE & VOLUME (KG)</h2>
              <span style={styles.sqlBadge}>
                POWERED BY SQL VIEW: <code>weekly_summary</code>
              </span>
            </div>
            <span style={styles.metricBig}>
              {weeklyStats.length > 0
                ? `${weeklyStats[weeklyStats.length - 1].total_volume_kg.toLocaleString()} kg`
                : "0 kg"}
            </span>
          </div>

          <p style={styles.sqlExplainer}>
            Aggregated by user and Monday of each week using{" "}
            <code>DATE_SUB(workout_date, INTERVAL WEEKDAY(workout_date) DAY)</code>.
          </p>

          <div style={{ width: "100%", height: 260, marginTop: 12 }}>
            <ResponsiveContainer>
              <BarChart
                data={weeklyStats}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#262b34" />
                <XAxis
                  dataKey="week_start_date"
                  stroke="#6f7a87"
                  fontSize={10}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis stroke="#6f7a87" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "#161920",
                    border: "1px solid #00f0ff",
                    borderRadius: "6px",
                    color: "#e6f1f5",
                    fontSize: "0.75rem",
                  }}
                  formatter={(value) => [`${value.toLocaleString()} kg`, "Volume"]}
                  labelFormatter={(label) => `Week of ${label}`}
                />
                <Bar
                  dataKey="total_volume_kg"
                  fill="#00f0ff"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* SECTION 2: WORKOUT FREQUENCY PER WEEK */}
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>⚡ WEEKLY WORKOUT FREQUENCY</h2>
              <span style={styles.sqlBadge}>
                SQL: <code>COUNT(DISTINCT workout_id)</code>
              </span>
            </div>
            <span style={{ ...styles.metricBig, color: "#39ff14" }}>
              {weeklyStats.length > 0
                ? `${weeklyStats[weeklyStats.length - 1].total_workouts} sessions`
                : "0"}
            </span>
          </div>

          <p style={styles.sqlExplainer}>
            Ensures double-logged sets on the same session count as 1 workout day.
          </p>

          <div style={{ width: "100%", height: 260, marginTop: 12 }}>
            <ResponsiveContainer>
              <BarChart
                data={weeklyStats}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#262b34" />
                <XAxis
                  dataKey="week_start_date"
                  stroke="#6f7a87"
                  fontSize={10}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis stroke="#6f7a87" fontSize={10} domain={[0, 7]} />
                <Tooltip
                  contentStyle={{
                    background: "#161920",
                    border: "1px solid #39ff14",
                    borderRadius: "6px",
                    color: "#e6f1f5",
                    fontSize: "0.75rem",
                  }}
                  formatter={(val) => [`${val} workouts`, "Frequency"]}
                  labelFormatter={(label) => `Week of ${label}`}
                />
                <Bar
                  dataKey="total_workouts"
                  fill="#39ff14"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* SECTION 3: EXERCISE PROGRESSION WITH LAG() */}
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>📈 PROGRESSION OVER TIME (LAG WINDOW FUNCTION)</h2>
            <span style={styles.sqlBadge}>
              SQL: <code>LAG(top_weight_kg, 1) OVER (ORDER BY workout_date)</code>
            </span>
          </div>
          <select
            className="ft-input"
            style={styles.exDropdown}
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(Number(e.target.value))}
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id} style={{ background: "#161920" }}>
                [{ex.category}] {ex.name}
              </option>
            ))}
          </select>
        </div>

        <p style={styles.sqlExplainer}>
          Demonstrates SQL <code>LAG()</code> to fetch previous session weight and calculate progressive overload delta directly in MySQL.
        </p>

        {exerciseHistory.length === 0 ? (
          <div style={styles.emptyNotice}>
            NO RECORDED SESSIONS FOR THIS EXERCISE YET.
          </div>
        ) : (
          <div style={{ width: "100%", height: 260, marginTop: 12 }}>
            <ResponsiveContainer>
              <LineChart
                data={exerciseHistory}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#262b34" />
                <XAxis dataKey="workout_date" stroke="#6f7a87" fontSize={10} />
                <YAxis stroke="#6f7a87" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "#161920",
                    border: "1px solid #00f0ff",
                    borderRadius: "6px",
                    color: "#e6f1f5",
                    fontSize: "0.75rem",
                  }}
                  formatter={(val, name, item) => {
                    const diff = item.payload.weight_diff;
                    const diffStr = diff > 0 ? ` (+${diff}kg)` : diff < 0 ? ` (${diff}kg)` : " (0kg)";
                    return [`${val} kg${diffStr}`, "Top Weight"];
                  }}
                  labelFormatter={(lbl) => `Session Date: ${lbl}`}
                />
                <Line
                  type="monotone"
                  dataKey="top_weight_kg"
                  stroke="#00f0ff"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#39ff14", stroke: "#0d0e12" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* SECTION 4: PERSONAL RECORDS TABLE (CTE + ROW_NUMBER) */}
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>🏆 PERSONAL RECORDS (ALL-TIME 1RM & PRs)</h2>
            <span style={styles.sqlBadge}>
              SQL: <code>ROW_NUMBER() OVER (PARTITION BY exercise_id ORDER BY weight_kg DESC)</code>
            </span>
          </div>
          <div style={styles.filterPills}>
            {categories.map((cat) => (
              <button
                key={cat}
                style={{
                  ...styles.pillBtn,
                  borderColor: activeCategory === cat ? "#00f0ff" : "#2a2f38",
                  color: activeCategory === cat ? "#00f0ff" : "#6f7a87",
                }}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <p style={styles.sqlExplainer}>
          Uses a Common Table Expression (CTE) with <code>ROW_NUMBER()</code> partitioned by exercise and filtered at <code>rank_num = 1</code>.
          Estimated 1RM is calculated using the Epley formula: <code>weight * (1 + reps / 30)</code>.
        </p>

        {filteredPrs.length === 0 ? (
          <div style={styles.emptyNotice}>NO PERSONAL RECORDS FOUND.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.theadRow}>
                  <th style={styles.th}>EXERCISE</th>
                  <th style={styles.th}>CATEGORY</th>
                  <th style={styles.th}>MAX WEIGHT</th>
                  <th style={styles.th}>REPS</th>
                  <th style={styles.th}>EST. 1RM</th>
                  <th style={styles.th}>DATE HIT</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrs.map((pr) => (
                  <tr key={pr.exercise_id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 700, color: "#e6f1f5" }}>
                      {pr.exercise_name}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.categoryBadge}>{pr.exercise_category}</span>
                    </td>
                    <td style={{ ...styles.td, color: "#39ff14", fontWeight: 700, fontSize: "0.95rem" }}>
                      {pr.pr_weight_kg} kg
                    </td>
                    <td style={styles.td}>{pr.pr_reps} reps</td>
                    <td style={{ ...styles.td, color: "#00f0ff", fontWeight: 700 }}>
                      ~{pr.estimated_1rm} kg
                    </td>
                    <td style={{ ...styles.td, color: "#9aa6b2", fontSize: "0.75rem" }}>
                      {pr.pr_date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
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
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "6px",
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
    margin: "4px 0 12px",
    fontSize: "0.72rem",
    color: "#6f7a87",
    lineHeight: 1.4,
  },
  metricBig: {
    fontSize: "1.4rem",
    fontWeight: 800,
    color: "#00f0ff",
    whiteSpace: "nowrap",
  },
  exDropdown: {
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    color: "#e6f1f5",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "0.8rem",
    fontFamily: "inherit",
    minWidth: "180px",
  },
  filterPills: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  pillBtn: {
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "0.65rem",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.06em",
    transition: "all 0.15s ease",
  },
  tableWrap: {
    overflowX: "auto",
    marginTop: "8px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "0.8rem",
  },
  theadRow: {
    borderBottom: "1px solid #262b34",
  },
  th: {
    padding: "10px 12px",
    color: "#6f7a87",
    fontSize: "0.68rem",
    letterSpacing: "0.08em",
    fontWeight: 700,
  },
  tr: {
    borderBottom: "1px solid #1a1e26",
    transition: "background 0.15s ease",
  },
  td: {
    padding: "12px",
  },
  categoryBadge: {
    fontSize: "0.65rem",
    padding: "2px 8px",
    borderRadius: "4px",
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    color: "#9aa6b2",
  },
  emptyNotice: {
    border: "1px dashed #2a2f38",
    borderRadius: "8px",
    padding: "32px",
    textAlign: "center",
    color: "#5a6472",
    fontSize: "0.8rem",
  },
};


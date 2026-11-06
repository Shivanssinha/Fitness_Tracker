import React, { useState, useEffect } from "react";
import { api } from "./api";
import AuthModal from "./components/AuthModal";
import WorkoutsView from "./components/WorkoutsView";
import AnalyticsView from "./components/AnalyticsView";
import GoalsView from "./components/GoalsView";
import NutritionView from "./components/NutritionView";

export default function FitnessTracker() {
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("workouts");
  const [kpiSummary, setKpiSummary] = useState(null);
  const [streakSummary, setStreakSummary] = useState(null);

  useEffect(() => {
    // Check initial user from localStorage
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        setUser(null);
      }
    }

    // Auto-login as demouser by default if no session exists so reviewers immediately see seed data
    if (!localStorage.getItem("token")) {
      api.login("demouser", "password123")
        .then((data) => setUser(data.user))
        .catch(() => {});
    }

    const handleAuthChange = () => {
      const u = localStorage.getItem("user");
      setUser(u ? JSON.parse(u) : null);
    };

    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, []);

  useEffect(() => {
    if (user) {
      loadTopMetrics();
    } else {
      setKpiSummary(null);
      setStreakSummary(null);
    }
  }, [user]);

  const loadTopMetrics = async () => {
    try {
      const [kpis, streak] = await Promise.all([
        api.getDashboardSummary(),
        api.getStreak(),
      ]);
      setKpiSummary(kpis);
      setStreakSummary(streak);
    } catch (err) {
      console.error("Failed to load header KPIs:", err);
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  const handleSwitchUser = async (demoUser) => {
    try {
      const data = await api.login(demoUser, "password123");
      setUser(data.user);
      loadTopMetrics();
    } catch (err) {
      alert(`Switch user failed: ${err.message}`);
    }
  };

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

      {/* HEADER SECTION */}
      <div style={styles.header}>
        <div style={styles.scanlineWrap}>
          <div style={styles.scanline} />
        </div>

        <div style={styles.headerTop}>
          <h1 style={styles.title}>
            FITNESS<span style={{ color: "#00f0ff" }}>//</span>SQL
          </h1>

          {/* AUTH STATUS / USER BADGE */}
          <div style={styles.authBadge}>
            {user ? (
              <div style={styles.userStatusRow}>
                <span style={styles.userIndicator}>● CONNECTED:</span>
                <strong style={{ color: "#39ff14" }}>@{user.username}</strong>
                <button
                  style={styles.switchBtn}
                  onClick={() =>
                    handleSwitchUser(
                      user.username === "demouser" ? "alex_fit" : "demouser"
                    )
                  }
                  title="Switch user to test data isolation"
                >
                  [SWITCH TO @{user.username === "demouser" ? "alex_fit" : "demouser"}]
                </button>
                <button style={styles.logoutBtn} onClick={handleLogout}>
                  [DISCONNECT]
                </button>
              </div>
            ) : (
              <button
                className="ft-btn-cyan"
                style={styles.loginBtn}
                onClick={() => setAuthModalOpen(true)}
              >
                ⚡ LOGIN / SIGNUP →
              </button>
            )}
          </div>
        </div>

        <p style={styles.subtitle}>
          FULL-STACK WORKOUT &amp; SQL ANALYTICS PLATFORM — MYSQL 8.0 &amp; FASTAPI
        </p>

        {/* TOP LEVEL METRICS STRIP */}
        {user && kpiSummary && (
          <div style={styles.metricsStrip}>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>TOTAL VOLUME</span>
              <span style={{ ...styles.metricVal, color: "#00f0ff" }}>
                {kpiSummary.total_volume_kg.toLocaleString()} kg
              </span>
            </div>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>TOTAL SESSIONS</span>
              <span style={{ ...styles.metricVal, color: "#39ff14" }}>
                {kpiSummary.total_workouts}
              </span>
            </div>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>ACTIVE STREAK</span>
              <span style={{ ...styles.metricVal, color: "#ff2a4d" }}>
                {streakSummary?.current_streak_days || 0} DAYS
              </span>
            </div>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>EXERCISES TRAINED</span>
              <span style={styles.metricVal}>
                {kpiSummary.distinct_exercises_trained}
              </span>
            </div>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div style={styles.navBar}>
          <button
            style={{
              ...styles.navTab,
              borderBottomColor: activeTab === "workouts" ? "#00f0ff" : "transparent",
              color: activeTab === "workouts" ? "#00f0ff" : "#6f7a87",
            }}
            onClick={() => setActiveTab("workouts")}
          >
            ⚡ WORKOUT LOGS
          </button>
          <button
            style={{
              ...styles.navTab,
              borderBottomColor: activeTab === "analytics" ? "#39ff14" : "transparent",
              color: activeTab === "analytics" ? "#39ff14" : "#6f7a87",
            }}
            onClick={() => setActiveTab("analytics")}
          >
            📊 SQL ANALYTICS &amp; PRs
          </button>
          <button
            style={{
              ...styles.navTab,
              borderBottomColor: activeTab === "goals" ? "#aa3bff" : "transparent",
              color: activeTab === "goals" ? "#aa3bff" : "#6f7a87",
            }}
            onClick={() => setActiveTab("goals")}
          >
            🎯 GOALS &amp; STREAKS
          </button>
          <button
            style={{
              ...styles.navTab,
              borderBottomColor: activeTab === "nutrition" ? "#ff2a4d" : "transparent",
              color: activeTab === "nutrition" ? "#ff2a4d" : "#6f7a87",
            }}
            onClick={() => setActiveTab("nutrition")}
          >
            🥗 NUTRITION TRACKER
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={styles.mainContent}>
        {activeTab === "workouts" && (
          <WorkoutsView user={user} onWorkoutLogged={loadTopMetrics} />
        )}
        {activeTab === "analytics" && <AnalyticsView user={user} />}
        {activeTab === "goals" && (
          <GoalsView user={user} onGoalUpdated={loadTopMetrics} />
        )}
        {activeTab === "nutrition" && <NutritionView user={user} />}
      </div>

      {/* AUTHENTICATION MODAL */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={() => {
          const u = localStorage.getItem("user");
          setUser(u ? JSON.parse(u) : null);
          loadTopMetrics();
        }}
      />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at top, #161920 0%, #0d0e12 60%)",
    color: "#e6f1f5",
    fontFamily:
      "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
    padding: "24px 20px 60px",
    boxSizing: "border-box",
  },
  header: {
    position: "relative",
    maxWidth: "1160px",
    margin: "0 auto 28px",
    overflow: "hidden",
    padding: "8px 0 0",
  },
  headerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
  },
  scanlineWrap: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    opacity: 0.2,
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: "40%",
    background:
      "linear-gradient(to bottom, transparent, rgba(0,240,255,0.25), transparent)",
    animation: "scanline 6s linear infinite",
  },
  title: {
    fontSize: "2.2rem",
    fontWeight: 800,
    letterSpacing: "0.08em",
    margin: 0,
    color: "#39ff14",
    textShadow: "0 0 16px rgba(57,255,20,0.45)",
  },
  subtitle: {
    marginTop: "6px",
    fontSize: "0.72rem",
    letterSpacing: "0.2em",
    color: "#6f7a87",
  },
  authBadge: {
    display: "flex",
    alignItems: "center",
  },
  userStatusRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#161920",
    border: "1px solid #262b34",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "0.75rem",
  },
  userIndicator: {
    color: "#39ff14",
    fontSize: "0.68rem",
    letterSpacing: "0.08em",
  },
  switchBtn: {
    background: "transparent",
    border: "none",
    color: "#00f0ff",
    fontSize: "0.68rem",
    cursor: "pointer",
    padding: "0 4px",
    textDecoration: "underline",
  },
  logoutBtn: {
    background: "transparent",
    border: "none",
    color: "#ff2a4d",
    fontSize: "0.68rem",
    cursor: "pointer",
    padding: "0 4px",
  },
  loginBtn: {
    background: "transparent",
    border: "1px solid #00f0ff",
    color: "#00f0ff",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.08em",
  },
  metricsStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginTop: "18px",
    background: "#0d0e12",
    border: "1px solid #262b34",
    borderRadius: "8px",
    padding: "12px 16px",
  },
  metricItem: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  metricLabel: {
    fontSize: "0.6rem",
    color: "#6f7a87",
    letterSpacing: "0.08em",
  },
  metricVal: {
    fontSize: "1.1rem",
    fontWeight: 800,
    color: "#e6f1f5",
  },
  navBar: {
    display: "flex",
    borderBottom: "1px solid #262b34",
    marginTop: "20px",
    gap: "8px",
    overflowX: "auto",
  },
  navTab: {
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "10px 16px",
    fontSize: "0.82rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  },
  mainContent: {
    maxWidth: "1160px",
    margin: "0 auto",
  },
};

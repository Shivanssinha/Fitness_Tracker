import React, { useState } from "react";
import { api } from "../api";

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await api.register(username, email, password);
      } else {
        await api.login(username, password);
      }
      onAuthSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoUsername) => {
    setError("");
    setLoading(true);
    try {
      await api.login(demoUsername, "password123");
      onAuthSuccess();
      onClose();
    } catch (err) {
      setError(`Demo login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.card}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>
            {isRegister ? "CREATE ACCOUNT" : "AUTHENTICATE"}
          </h2>
          <button style={modalStyles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {error && <div style={modalStyles.error}>{error}</div>}

        <div style={modalStyles.tabRow}>
          <button
            style={{
              ...modalStyles.tabBtn,
              borderBottomColor: !isRegister ? "#00f0ff" : "transparent",
              color: !isRegister ? "#00f0ff" : "#6f7a87",
            }}
            onClick={() => { setIsRegister(false); setError(""); }}
          >
            LOGIN
          </button>
          <button
            style={{
              ...modalStyles.tabBtn,
              borderBottomColor: isRegister ? "#39ff14" : "transparent",
              color: isRegister ? "#39ff14" : "#6f7a87",
            }}
            onClick={() => { setIsRegister(true); setError(""); }}
          >
            SIGNUP
          </button>
        </div>

        <form onSubmit={handleSubmit} style={modalStyles.form}>
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>USERNAME</label>
            <input
              type="text"
              required
              className="ft-input"
              style={modalStyles.input}
              placeholder="e.g. demouser"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {isRegister && (
            <div style={modalStyles.field}>
              <label style={modalStyles.label}>EMAIL ADDRESS</label>
              <input
                type="email"
                required
                className="ft-input"
                style={modalStyles.input}
                placeholder="athlete@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <div style={modalStyles.field}>
            <label style={modalStyles.label}>PASSWORD</label>
            <input
              type="password"
              required
              className="ft-input"
              style={modalStyles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="ft-btn-cyan"
            style={modalStyles.submitBtn}
          >
            {loading ? "PROCESSING..." : isRegister ? "REGISTER & CONNECT →" : "LOGIN →"}
          </button>
        </form>

        {/* RECRUITER / DEMO SHORTCUTS */}
        <div style={modalStyles.demoSection}>
          <span style={modalStyles.demoLabel}>INTERVIEW DEMO ACCOUNTS:</span>
          <div style={modalStyles.demoBtnRow}>
            <button
              className="ft-btn-lime"
              style={modalStyles.demoBtn}
              onClick={() => handleQuickDemo("demouser")}
            >
              ⚡ LOGIN AS DEMOUSER (FULL HISTORY)
            </button>
            <button
              className="ft-btn-cyan"
              style={modalStyles.demoBtnAlt}
              onClick={() => handleQuickDemo("alex_fit")}
            >
              👤 LOGIN AS ALEX_FIT (TEST ISOLATION)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(13, 14, 18, 0.85)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px",
  },
  card: {
    background: "#161920",
    border: "1px solid #262b34",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "460px",
    padding: "28px",
    boxShadow: "0 0 30px rgba(0,240,255,0.15)",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "18px",
  },
  title: {
    margin: 0,
    fontSize: "1.2rem",
    letterSpacing: "0.1em",
    color: "#00f0ff",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#6f7a87",
    fontSize: "1.2rem",
    cursor: "pointer",
  },
  tabRow: {
    display: "flex",
    borderBottom: "1px solid #262b34",
    marginBottom: "20px",
  },
  tabBtn: {
    flex: 1,
    padding: "10px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    fontSize: "0.85rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "0.68rem",
    color: "#6f7a87",
    letterSpacing: "0.1em",
  },
  input: {
    background: "#0d0e12",
    border: "1px solid #2a2f38",
    borderRadius: "6px",
    padding: "10px 12px",
    color: "#e6f1f5",
    fontSize: "0.9rem",
    fontFamily: "inherit",
  },
  submitBtn: {
    marginTop: "8px",
    background: "transparent",
    border: "1px solid #00f0ff",
    color: "#00f0ff",
    borderRadius: "6px",
    padding: "12px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    cursor: "pointer",
  },
  error: {
    background: "rgba(255,42,77,0.1)",
    border: "1px solid #ff2a4d",
    color: "#ff2a4d",
    padding: "10px",
    borderRadius: "6px",
    fontSize: "0.78rem",
    marginBottom: "14px",
  },
  demoSection: {
    marginTop: "24px",
    borderTop: "1px dashed #262b34",
    paddingTop: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  demoLabel: {
    fontSize: "0.68rem",
    letterSpacing: "0.1em",
    color: "#9aa6b2",
    textAlign: "center",
  },
  demoBtnRow: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  demoBtn: {
    background: "transparent",
    border: "1px solid #39ff14",
    color: "#39ff14",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    cursor: "pointer",
  },
  demoBtnAlt: {
    background: "transparent",
    border: "1px solid #00f0ff",
    color: "#00f0ff",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    cursor: "pointer",
  },
};


// ============================================================================
// FITNESS TRACKER - FRONTEND API CLIENT
// Connects React UI to FastAPI backend endpoints with JWT authentication
// ============================================================================

const BASE_URL = "/api";

function getHeaders() {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, config);

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.detail || `HTTP error ${response.status}`;
    // If token expired, clear invalid session
    if (response.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth-changed"));
    }
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------
  async login(username, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (data?.access_token) {
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("auth-changed"));
    }
    return data;
  },

  async register(username, email, password) {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    if (data?.access_token) {
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("auth-changed"));
    }
    return data;
  },

  async getMe() {
    return request("/auth/me");
  },

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-changed"));
  },

  // --------------------------------------------------------------------------
  // EXERCISES
  // --------------------------------------------------------------------------
  async getExercises() {
    return request("/exercises");
  },

  async createExercise(exerciseData) {
    return request("/exercises", {
      method: "POST",
      body: JSON.stringify(exerciseData),
    });
  },

  // --------------------------------------------------------------------------
  // WORKOUTS (ATOMIC TRANSACTION WITH SETS)
  // --------------------------------------------------------------------------
  async getWorkouts(startDate, endDate) {
    let query = "";
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (params.toString()) query = `?${params.toString()}`;
    return request(`/workouts${query}`);
  },

  async getWorkout(id) {
    return request(`/workouts/${id}`);
  },

  async createWorkout(workoutData) {
    return request("/workouts", {
      method: "POST",
      body: JSON.stringify(workoutData),
    });
  },

  async deleteWorkout(id) {
    return request(`/workouts/${id}`, {
      method: "DELETE",
    });
  },

  // --------------------------------------------------------------------------
  // ANALYTICS (RAW SQL QUERIES)
  // --------------------------------------------------------------------------
  async getWeeklyStats(limit = 12) {
    return request(`/analytics/weekly-stats?limit=${limit}`);
  },

  async getPersonalRecords() {
    return request("/analytics/personal-records");
  },

  async getExerciseHistory(exerciseId) {
    return request(`/analytics/exercise-history/${exerciseId}`);
  },

  async getStreak() {
    return request("/analytics/streak");
  },

  async getGoalsProgress() {
    return request("/analytics/goals-progress");
  },

  async getDashboardSummary() {
    return request("/analytics/dashboard-summary");
  },

  // --------------------------------------------------------------------------
  // GOALS
  // --------------------------------------------------------------------------
  async getGoals() {
    return request("/goals");
  },

  async createGoal(goalData) {
    return request("/goals", {
      method: "POST",
      body: JSON.stringify(goalData),
    });
  },

  async updateGoal(id, updates) {
    return request(`/goals/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async deleteGoal(id) {
    return request(`/goals/${id}`, {
      method: "DELETE",
    });
  },

  // --------------------------------------------------------------------------
  // NUTRITION (PRESERVES EXISTING FRONTEND)
  // --------------------------------------------------------------------------
  async getNutritionLogs(dateStr) {
    const query = dateStr ? `?logged_date=${dateStr}` : "";
    return request(`/nutrition${query}`);
  },

  async createNutritionLog(logData) {
    return request("/nutrition", {
      method: "POST",
      body: JSON.stringify(logData),
    });
  },

  async deleteNutritionLog(id) {
    return request(`/nutrition/${id}`, {
      method: "DELETE",
    });
  },
};


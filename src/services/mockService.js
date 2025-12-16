/**
 * mockService.js
 * Simulates API calls with a delay.
 * Data is persisted in localStorage to mimic database persistence across reloads.
 */

// Keys for localStorage
const DB_USERS = "db_users";
const DB_SESSIONS = "db_session";

// Helper: Simulate network delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Get users from local storage
const getUsers = () => {
  const users = localStorage.getItem(DB_USERS);
  return users ? JSON.parse(users) : [];
};

// Helper: Save users
const saveUser = (user) => {
  const users = getUsers();
  users.push(user);
  localStorage.setItem(DB_USERS, JSON.stringify(users));
};

export const mockService = {
  /**
   * Login User
   * @param {string} email 
   * @param {string} password 
   */
  login: async (email, password) => {
    await delay(800);
    const users = getUsers();
    const user = users.find((u) => u.email === email && u.password === password);

    if (user) {
      // Create session (simple, just return user without password)
      const { password, ...safeUser } = user;
      return safeUser;
    }
    throw new Error("Invalid credentials");
  },

  /**
   * Register User
   * @param {object} userData 
   */
  signup: async (userData) => {
    await delay(1000);
    const users = getUsers();
    
    if (users.find((u) => u.email === userData.email)) {
      throw new Error("User already exists");
    }

    const newUser = {
      id: Date.now().toString(),
      ...userData,
      // Default mock stats
      followers: "10k",
      totalCollabs: 0,
    };

    saveUser(newUser);
    
    // Return safe user
    const { password, ...safeUser } = newUser;
    return safeUser;
  },

  /**
   * Get Current User Data (by ID)
   */
  getUserProfile: async (id) => {
    await delay(500);
    const users = getUsers();
    const user = users.find(u => u.id === id);
    if(user) {
        const { password, ...safeUser } = user;
        return safeUser;
    }
    return null;
  }
};

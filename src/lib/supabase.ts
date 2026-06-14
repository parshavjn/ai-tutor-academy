import { createClient } from "@supabase/supabase-js";
import { UserProgressData } from "../types";

const supabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL as string) || "";
const supabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY as string) || "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("MY_SUPABASE"));

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Sandbox Engine for development preview (Local Storage simulation)
class SandboxAuth {
  private static STORAGE_KEY = "ai_tutor_sandbox_users";
  private static DECOY_SESSION_KEY = "ai_tutor_sandbox_active_user";

  static getUsers() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  }

  static getActiveUser() {
    const userJson = localStorage.getItem(this.DECOY_SESSION_KEY);
    return userJson ? JSON.parse(userJson) : null;
  }

  static setActiveUser(user: any) {
    if (user) {
      localStorage.setItem(this.DECOY_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.DECOY_SESSION_KEY);
    }
  }

  static signUp(email: string) {
    const users = this.getUsers();
    if (users[email]) {
      const mockUser = {
        id: users[email].id,
        email,
        created_at: users[email].created_at,
      };
      this.setActiveUser(mockUser);
      return { data: { user: mockUser }, error: null };
    }
    const mockUser = {
      id: "sb_" + Math.random().toString(36).substring(2, 11),
      email,
      created_at: new Date().toISOString(),
    };
    users[email] = { ...mockUser, progress: { xp: 0, streak: 0, lastActive: null, completedLessons: [] } };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(users));
    this.setActiveUser(mockUser);
    return { data: { user: mockUser }, error: null };
  }

  static signIn(email: string) {
    const users = this.getUsers();
    const existing = users[email];
    if (!existing) {
      // For developer comfort in preview, let's auto-create on login if not found
      return this.signUp(email);
    }
    const mockUser = { id: existing.id, email: existing.email };
    this.setActiveUser(mockUser);
    return { data: { user: mockUser }, error: null };
  }

  static signOut() {
    this.setActiveUser(null);
    return { error: null };
  }
}

// Unified Authenticator Layer
export const authService = {
  /**
   * Send a magic link to the user's email for passwordless sign-in.
   * For sandbox mode, this instantly "signs in" the user (no email needed).
   */
  async signIn(email: string, forceSandbox = false): Promise<{ user: any; error: string | null; isSandbox: boolean; magicLinkSent?: boolean }> {
    if (supabase && !forceSandbox) {
      try {
        // Send a magic link to the user's email.
        // When they click the link, Supabase will redirect them back to the app
        // and the onAuthStateChange listener will detect the session.
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true, // Auto-create account if new user
            // Redirect back to the current app origin after clicking the magic link
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          return { user: null, error: error.message, isSandbox: false };
        }
        // Magic link sent — user needs to check their email and click the link
        return { user: null, error: null, isSandbox: false, magicLinkSent: true };
      } catch (err: any) {
        return { user: null, error: err.message || "Failed to send sign-in link", isSandbox: false };
      }
    } else {
      // Sandbox: instant login, no email needed
      try {
        const { data } = SandboxAuth.signIn(email);
        return { user: data.user, error: null, isSandbox: true };
      } catch (err: any) {
        return { user: null, error: err.message, isSandbox: true };
      }
    }
  },

  /**
   * Listen for auth state changes (e.g., when user returns from magic link).
   * Returns an unsubscribe function.
   */
  onAuthStateChange(callback: (event: string, session: any) => void): (() => void) | null {
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
      return () => subscription.unsubscribe();
    }
    return null;
  },

  async signOut(): Promise<void> {
    if (supabase) {
      await supabase.auth.signOut();
    }
    SandboxAuth.signOut();
  },

  async getCurrentUser(): Promise<any> {
    const sandboxUser = SandboxAuth.getActiveUser();
    if (sandboxUser) {
      return sandboxUser;
    }
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      return data?.user || null;
    }
    return null;
  }
};

// Unified Storage / Progress persistence Layer
export const progressService = {
  async getProgress(userId: string): Promise<UserProgressData> {
    const defaultProgress: UserProgressData = {
      xp: 0,
      streak: 0,
      lastActive: null,
      completedLessons: [],
    };

    if (supabase && !userId.startsWith("sb_")) {
      try {
        const { data, error } = await supabase
          .from("ai_tutor_progress")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          // Put standard user progress
          await supabase.from("ai_tutor_progress").insert({
            user_id: userId,
            xp: 0,
            streak: 0,
            last_active: null,
            completed_lessons: [],
          });
          return defaultProgress;
        }

        return {
          xp: data.xp,
          streak: data.streak,
          lastActive: data.last_active,
          completedLessons: data.completed_lessons || [],
        };
      } catch (err) {
        console.warn("Supabase load error, falling back to empty progress", err);
        return defaultProgress;
      }
    } else {
      // Local Storage sandbox
      const users = SandboxAuth.getUsers();
      const activeUser = SandboxAuth.getActiveUser();
      if (activeUser && users[activeUser.email]) {
        return users[activeUser.email].progress || defaultProgress;
      }
      return defaultProgress;
    }
  },

  async saveProgress(userId: string, progress: UserProgressData): Promise<void> {
    if (supabase && !userId.startsWith("sb_")) {
      try {
        await supabase.from("ai_tutor_progress").upsert({
          user_id: userId,
          xp: progress.xp,
          streak: progress.streak,
          last_active: progress.lastActive,
          completed_lessons: progress.completedLessons,
        });
      } catch (err) {
        console.error("Failed to save progress to Supabase", err);
      }
    } else {
      const users = SandboxAuth.getUsers();
      const activeUser = SandboxAuth.getActiveUser();
      if (activeUser && users[activeUser.email]) {
        users[activeUser.email].progress = progress;
        localStorage.setItem("ai_tutor_sandbox_users", JSON.stringify(users));
      }
    }
  },

  async saveSessionLog(userId: string, conceptName: string, quizScore: number, rating: string, feedback: string) {
    if (supabase && !userId.startsWith("sb_")) {
      try {
        await supabase.from("ai_tutor_logs").insert({
          user_id: userId,
          concept_name: conceptName,
          quiz_score: quizScore,
          rating,
          feedback,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Failed to write to Supabase log table", err);
      }
    } else {
      const logs = JSON.parse(localStorage.getItem("ai_tutor_sandbox_logs") || "[]");
      logs.push({
        userId,
        conceptName,
        quizScore,
        rating,
        feedback,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem("ai_tutor_sandbox_logs", JSON.stringify(logs));
    }
  },

  async getSessionLogs(userId: string): Promise<any[]> {
    if (supabase && !userId.startsWith("sb_")) {
      try {
        const { data } = await supabase
          .from("ai_tutor_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        return data || [];
      } catch (err) {
        return [];
      }
    } else {
      const logs = JSON.parse(localStorage.getItem("ai_tutor_sandbox_logs") || "[]");
      return logs.filter((l: any) => l.userId === userId);
    }
  }
};

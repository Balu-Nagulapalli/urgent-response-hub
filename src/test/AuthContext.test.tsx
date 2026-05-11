import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "../AuthContext";

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Test helpers ─────────────────────────────────────────────────────────────

const TestLogin = ({ username = "cr_kakinada", password = "Admin@123" }) => {
  const { user, login, logout } = useAuth();
  return user ? (
    <div>
      <span data-testid="username">{user.username}</span>
      <span data-testid="role">{user.role}</span>
      <span data-testid="districtId">{user.districtId}</span>
      <span data-testid="districtName">{user.districtName}</span>
      <button onClick={logout}>Logout</button>
    </div>
  ) : (
    <button onClick={() => login(username, password)}>Login</button>
  );
};

const renderWithAuth = (ui = <TestLogin />) =>
  render(<AuthProvider>{ui}</AuthProvider>);

const mockDistrictUser = {
  success: true,
  user: {
    username: "cr_kakinada", displayName: "cr_kakinada",
    role: "control_room", sys_id: "abc123",
    districtId: "KKD", districtName: "Kakinada", phone: "9542071259",
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AuthContext — Session & Login", () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  afterEach(() => { localStorage.clear(); });

  it("starts with no user when localStorage is empty", () => {
    renderWithAuth();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("restores user from localStorage on mount (session persistence)", async () => {
    localStorage.setItem("auth_user", JSON.stringify(mockDistrictUser.user));
    renderWithAuth();
    await waitFor(() => {
      expect(screen.getByTestId("username")).toHaveTextContent("cr_kakinada");
    });
  });

  it("logs in district user via proxy — sets districtId and role correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => mockDistrictUser,
    });
    renderWithAuth();
    await userEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("control_room");
      expect(screen.getByTestId("districtId")).toHaveTextContent("KKD");
      expect(screen.getByTestId("districtName")).toHaveTextContent("Kakinada");
    });
  });

  it("stores auth_user in localStorage after successful login", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => mockDistrictUser,
    });
    renderWithAuth();
    await userEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("auth_user") ?? "null");
      expect(stored?.username).toBe("cr_kakinada");
      expect(stored?.districtId).toBe("KKD");
      expect(stored?.role).toBe("control_room");
    });
  });

  it("throws error on invalid credentials (proxy returns 401)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 401,
      json: async () => ({ error: "Invalid username or password." }),
    });
    const TestError = () => {
      const { login } = useAuth();
      const [err, setErr] = React.useState("");
      return (
        <div>
          <span data-testid="error">{err}</span>
          <button onClick={() => login("wrong", "wrong").catch(e => setErr(e.message))}>
            Login
          </button>
        </div>
      );
    };
    render(<AuthProvider><TestError /></AuthProvider>);
    await userEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Invalid username or password.");
    });
  });

  it("clears localStorage and user state on logout", async () => {
    localStorage.setItem("auth_user", JSON.stringify(mockDistrictUser.user));
    renderWithAuth();
    await waitFor(() => screen.getByTestId("username"));
    await userEvent.click(screen.getByRole("button", { name: /logout/i }));
    await waitFor(() => {
      expect(localStorage.getItem("auth_user")).toBeNull();
      expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
    });
  });

  it("hardcoded team user (control_room) logs in WITHOUT proxy call", async () => {
    const TestTeam = () => {
      const { user, login } = useAuth();
      return user
        ? <span data-testid="role">{user.role}</span>
        : <button onClick={() => login("control_room", "Admin@123")}>Login</button>;
    };
    render(<AuthProvider><TestTeam /></AuthProvider>);
    await userEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("control_room");
      // Proxy should NOT have been called for hardcoded users
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it("super_admin gets districtId ALL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        user: {
          username: "superadmin", displayName: "superadmin",
          role: "super_admin", sys_id: "xyz",
          districtId: "ALL", districtName: "All Districts", phone: "",
        },
      }),
    });
    const TestSuper = () => {
      const { user, login } = useAuth();
      return user
        ? <span data-testid="districtId">{user.districtId}</span>
        : <button onClick={() => login("superadmin", "Admin@123")}>Login</button>;
    };
    render(<AuthProvider><TestSuper /></AuthProvider>);
    await userEvent.click(screen.getByRole("button", { name: /login/i }));
    await waitFor(() => {
      expect(screen.getByTestId("districtId")).toHaveTextContent("ALL");
    });
  });
});

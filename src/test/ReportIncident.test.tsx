import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ReportIncident from "../pages/ReportIncident";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock geolocation
const mockGetPosition = vi.fn();
Object.defineProperty(global.navigator, "geolocation", {
  value: { getCurrentPosition: mockGetPosition },
  writable: true,
});

// Mock useToast so toasts don't throw
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock VoiceRecorder so we don't need Groq in tests
vi.mock("@/components/VoiceRecorder", () => ({
  default: () => <div data-testid="voice-recorder" />,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderForm = () =>
  render(<MemoryRouter><ReportIncident /></MemoryRouter>);

describe("ReportIncident — Form Validation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders all required form fields", () => {
    renderForm();
    expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByText(/send help request/i)).toBeInTheDocument();
  });

  it("shows name validation error when name is too short", async () => {
    renderForm();
    await userEvent.click(screen.getByText(/send help request/i));
    await waitFor(() => {
      expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it("shows phone validation error for invalid number", async () => {
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/full name/i), "Test User");
    await userEvent.type(screen.getByPlaceholderText(/phone number/i), "123");
    await userEvent.click(screen.getByText(/send help request/i));
    await waitFor(() => {
      expect(screen.getByText(/valid phone/i)).toBeInTheDocument();
    });
  });

  it("shows location validation error when location missing", async () => {
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/full name/i), "Test User");
    await userEvent.type(screen.getByPlaceholderText(/phone number/i), "9876543210");
    await userEvent.click(screen.getByText(/send help request/i));
    await waitFor(() => {
      expect(screen.getByText(/detailed location/i)).toBeInTheDocument();
    });
  });

  it("shows emergency type error when not selected", async () => {
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/full name/i), "Test User");
    await userEvent.type(screen.getByPlaceholderText(/phone number/i), "9876543210");
    await userEvent.type(
      screen.getByPlaceholderText(/address/i),
      "Aditya Engineering College, Kakinada"
    );
    await userEvent.click(screen.getByText(/send help request/i));
    await waitFor(() => {
      expect(screen.getByText(/select an emergency type/i)).toBeInTheDocument();
    });
  });

  it("calls proxy endpoint on valid submission", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { number: "INC0010099" } }),
    });
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/full name/i), "Test User");
    await userEvent.type(screen.getByPlaceholderText(/phone number/i), "9876543210");
    await userEvent.type(
      screen.getByPlaceholderText(/address/i),
      "Aditya Engineering College, Kakinada, AP"
    );
    // Select emergency type via the Select component
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByText(/medical emergency/i));
    await userEvent.click(screen.getByText(/send help request/i));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/sn/incident"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("captures GPS and fills location field", async () => {
    mockGetPosition.mockImplementationOnce((success) =>
      success({ coords: { latitude: 17.09, longitude: 82.07, accuracy: 10 } })
    );
    // Mock reverse geocode call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ display_name: "Kakinada, Andhra Pradesh, India" }),
    });
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /gps/i }));
    await waitFor(() => {
      expect(screen.getByText(/gps captured/i)).toBeInTheDocument();
    });
  });

  it("does NOT include Authorization header in submission", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { number: "INC0010100" } }),
    });
    renderForm();
    await userEvent.type(screen.getByPlaceholderText(/full name/i), "Test User");
    await userEvent.type(screen.getByPlaceholderText(/phone number/i), "9876543210");
    await userEvent.type(
      screen.getByPlaceholderText(/address/i),
      "Aditya Engineering College, Kakinada, AP"
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByText(/medical emergency/i));
    await userEvent.click(screen.getByText(/send help request/i));
    await waitFor(() => {
      const callHeaders = mockFetch.mock.calls[0]?.[1]?.headers ?? {};
      expect(callHeaders["Authorization"]).toBeUndefined();
    });
  });
});

// Client test setup - runs before client-side tests
import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock URL methods not available in jsdom
global.URL.createObjectURL = vi.fn(() => "blob:test");
global.URL.revokeObjectURL = vi.fn();

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarkdownContent } from "@/client/components/MarkdownContent";

describe("MarkdownContent", () => {
  it("returns empty div for empty content", () => {
    const { container } = render(<MarkdownContent content="" />);
    expect(container.querySelector("div")?.children).toHaveLength(0);
  });

  it("renders plain text", () => {
    render(<MarkdownContent content="hello world" />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("renders fenced code blocks", () => {
    const content = "```js\nconst x = 1;\n```";
    const { container } = render(<MarkdownContent content={content} />);
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain("const x = 1;");
  });

  it("renders inline code", () => {
    render(<MarkdownContent content="use `foo()` here" />);
    const code = screen.getByText("foo()");
    expect(code.tagName).toBe("CODE");
  });

  it("renders bold text", () => {
    render(<MarkdownContent content="this is **bold** text" />);
    const strong = screen.getByText("bold");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders headers", () => {
    const content = ["# Title", "## Subtitle"].join("\n");
    const { container } = render(<MarkdownContent content={content} />);
    const headers = container.querySelectorAll("div.mt-1");
    expect(headers.length).toBeGreaterThanOrEqual(2);
    expect(headers[0]?.textContent).toBe("Title");
    expect(headers[1]?.textContent).toBe("Subtitle");
  });

  it("renders stack traces with red styling", () => {
    const trace = `Error: something failed
    at Object.run (/app/src/main.ts:42:10)
    at process (/app/src/main.ts:100:5)
    at bootstrap (/app/src/index.ts:12:3)`;
    const { container } = render(<MarkdownContent content={trace} />);
    const pre = container.querySelector("pre");
    expect(pre).toHaveClass("text-red-400");
  });

  it("renders mixed code and text blocks", () => {
    const content = "before\n```\ncode\n```\nafter";
    const { container } = render(<MarkdownContent content={content} />);
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toContain("code");
    expect(container.textContent).toContain("before");
    expect(container.textContent).toContain("after");
  });

  it("applies custom className", () => {
    const { container } = render(<MarkdownContent content="test" className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("applies default className when none provided", () => {
    const { container } = render(<MarkdownContent content="test" />);
    expect(container.firstChild).toHaveClass("max-w-prose");
  });
});

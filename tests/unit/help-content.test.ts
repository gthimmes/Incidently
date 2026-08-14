import { describe, expect, it } from "vitest";
import { renderMarkdown, ContentStore } from "help-navigator";
import { helpContent } from "@/lib/help/content";

// Integrity checks for the help corpus: broken ids and empty articles are
// content bugs that would otherwise only surface as dead links in the UI.
describe("help content", () => {
  const articleIds = new Set(helpContent.articles.map((a) => a.id));
  const categoryIds = new Set((helpContent.categories ?? []).map((c) => c.id));

  it("has unique article ids", () => {
    expect(articleIds.size).toBe(helpContent.articles.length);
  });

  it("has unique category ids", () => {
    expect(categoryIds.size).toBe(helpContent.categories?.length);
  });

  it("every article belongs to a declared category", () => {
    for (const a of helpContent.articles) {
      expect(a.category, `article "${a.id}" has no category`).toBeTruthy();
      expect(categoryIds.has(a.category!), `article "${a.id}" references unknown category "${a.category}"`).toBe(true);
    }
  });

  it("every declared category has at least one article", () => {
    for (const c of helpContent.categories ?? []) {
      const count = helpContent.articles.filter((a) => a.category === c.id).length;
      expect(count, `category "${c.id}" is empty`).toBeGreaterThan(0);
    }
  });

  it("every related id resolves to a real article", () => {
    for (const a of helpContent.articles) {
      for (const rel of a.related ?? []) {
        expect(articleIds.has(rel), `article "${a.id}" relates to unknown "${rel}"`).toBe(true);
        expect(rel, `article "${a.id}" relates to itself`).not.toBe(a.id);
      }
    }
  });

  it("every article has a non-trivial title and body", () => {
    for (const a of helpContent.articles) {
      expect(a.title.length, `"${a.id}" title too short`).toBeGreaterThan(5);
      expect(a.body.trim().length, `"${a.id}" body too short`).toBeGreaterThan(100);
    }
  });

  it("every body renders to HTML without leftover markdown link syntax", () => {
    for (const a of helpContent.articles) {
      const html = renderMarkdown(a.body);
      expect(html.length).toBeGreaterThan(0);
      expect(html, `"${a.id}" contains a dead](# link`).not.toContain("](#)");
    }
  });

  it("has featured articles to populate the help home view", () => {
    expect(helpContent.articles.filter((a) => a.featured).length).toBeGreaterThanOrEqual(4);
  });

  it("loads into a ContentStore without errors", () => {
    const store = new ContentStore(helpContent);
    expect(store.categories.length).toBe(helpContent.categories?.length);
    expect(store.articles.length).toBe(helpContent.articles.length);
  });
});

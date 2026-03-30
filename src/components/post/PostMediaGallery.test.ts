/** @vitest-environment jsdom */

import React from "react";
import ReactDOMClient from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PostMediaGallery from "@/components/post/PostMediaGallery";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PostMediaGallery", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders every media item with descriptive alt text", async () => {
    await act(async () => {
      root.render(
        React.createElement(PostMediaGallery, {
          title: "Generated gallery",
          media: [
            { id: "m1", url: "https://cdn.test/one.png", width: 1024, height: 1024 },
            { id: "m2", url: "https://cdn.test/two.png", width: 768, height: 512 },
          ],
        }),
      );
    });

    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(2);
    expect(images[0]?.getAttribute("alt")).toBe("Generated gallery image 1");
    expect(images[1]?.getAttribute("alt")).toBe("Generated gallery image 2");
    expect(container.textContent).toContain("1024 x 1024");
    expect(container.textContent).toContain("768 x 512");
  });

  it("renders nothing when there are no usable media urls", async () => {
    await act(async () => {
      root.render(
        React.createElement(PostMediaGallery, {
          title: "Empty gallery",
          media: [{ id: "m1", url: null }],
        }),
      );
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("");
  });
});

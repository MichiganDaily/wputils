import type { HTMLElement } from "node-html-parser";
import { parse } from "node-html-parser";

function trim(caption: string): string {
  const trimmed = caption
    .replace("Photo Courtesy of", "")
    .replace("Courtesy of", "")
    .replace("Courtesy", "")
    .replace("Design by", "")
    .replace("/Daily", "")
    .replace("/MiC", "")
    .replace("By ", "")
    .trim();

  return trimmed.endsWith(".")
    ? trimmed.substring(0, trimmed.length - 1)
    : trimmed;
}

function parseCaption(caption: HTMLElement | null): string {
  if (!caption) {
    return "";
  }

  const italicizedElement = caption.querySelector("i");
  if (!italicizedElement) {
    return trim(caption.textContent ?? "");
  }

  const parsableText = italicizedElement.textContent || caption.textContent;
  if (!parsableText) {
    return trim(caption.textContent ?? "");
  }

  return trim(parsableText);
}

export function parseImage(html: string) {
  const element = parse(html).querySelector("img")!;
  return {
    html: element.toString(),
    caption: parseCaption(
      parse(element.getAttribute("data-image-caption") ?? "").querySelector("p")
    ),
    width: element.getAttribute("width"),
    height: element.getAttribute("height"),
    src: element.getAttribute("src"),
    alt: element.getAttribute("alt"),
    sizes: element.getAttribute("sizes"),
    srcset: element.getAttribute("srcset"),
    permalink: element.getAttribute("data-permalink"),
  };
}

export function joinListOfStrings(strings: string[]) {
  if (strings.length === 0) {
    return "";
  }

  const deduplicatedStrings = Array.from(new Set(strings)).sort();
  return deduplicatedStrings.length === 1
    ? deduplicatedStrings[0]
    : `${deduplicatedStrings
        .slice(0, -1)
        .join(", ")} and ${deduplicatedStrings.at(-1)}`;
}

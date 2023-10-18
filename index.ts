import type { HTMLElement } from "node-html-parser";
import { parse } from "node-html-parser";

export type Image = {
  html: string;
  caption?: string;
  width: string | undefined;
  height: string | undefined;
  src: string | undefined;
  alt: string | undefined;
  sizes: string | undefined;
  srcset: string | undefined;
  permalink: string | undefined;
};

export type WordPressAuthor = {
  display_name: string;
  user_nicename: string;
};

export type WordPressFeaturedMedia = {
  embeddable: boolean;
  href: string;
};

export type WordPressArticle = {
  coauthors: WordPressAuthor[];
  link: string;
  title: {
    rendered: string;
  };
  _links: {
    "wp:featuredmedia": WordPressFeaturedMedia[];
  };
}

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

function parseImage(html: string): Image {
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

function joinListOfStrings(strings: string[]) {
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

export async function fetchPostFromSlug(slug: string) {
  const url = new URL("https://michigandaily.com/wp-json/wp/v2/posts");
  url.searchParams.set("slug", slug);
  url.searchParams.set("_fields", "coauthors,link,title,_links");

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = await response.json() as Array<WordPressArticle>;
  if (data.length === 0) {
    return null;
  }

  const story = data.at(0);
  const [feature] = story._links["wp:featuredmedia"];

  const imageRequest = await fetch(`${feature.href}?_fields=description`);
  const imageData = await imageRequest.json();
  const image = parseImage(imageData.description.rendered);

  return {
    url: story.link as string,
    title: story.title.rendered as string,
    coauthors: joinListOfStrings(
      story.coauthors.map((author) => author.display_name)
    ),
    image: image
  }
}
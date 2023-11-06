import type { HTMLElement } from "node-html-parser";
import { parse } from "node-html-parser";
import { decode } from "he";

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
};

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

function parseCaption(
  caption: HTMLElement | null,
  { getFullCaption }: { getFullCaption: boolean } = { getFullCaption: false }
): string {
  if (!caption) {
    return "";
  }

  if (getFullCaption) {
    return caption.innerHTML;
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

export function parseImage(
  html: string,
  { getFullCaption }: { getFullCaption?: boolean } = { getFullCaption: false }
): Image {
  const element = parse(html).querySelector("img")!;
  return {
    html: element.toString(),
    caption: parseCaption(
      parse(element.getAttribute("data-image-caption") ?? "").querySelector(
        "p"
      ),
      { getFullCaption }
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

export async function fetchImageFromSlug(
  slug: string,
  {
    getFullCaption,
    useCache,
  }: { getFullCaption?: boolean; useCache?: boolean } = {
    getFullCaption: false,
    useCache: true,
  }
) {
  const url = new URL("https://michigandaily.com/wp-json/wp/v2/media");
  url.searchParams.set("media_type", "image");
  url.searchParams.set("slug", slug);
  url.searchParams.set("_fields", "description");

  if (!useCache) {
    url.searchParams.set("time", new Date().toISOString());
  }

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as {
    description: { rendered: string };
  }[];

  if (json === undefined || json === null || json.length === 0) {
    return null;
  }

  const image = json.at(0);

  if (!image) {
    return null;
  }

  return parseImage(image.description.rendered, { getFullCaption });
}

export async function fetchPostFromSlug(
  slug: string,
  {
    useTestSite,
    useCache,
    getImage,
    getFullImageCaption,
  }: {
    useTestSite?: boolean;
    useCache?: boolean;
    getImage?: boolean;
    getFullImageCaption?: boolean;
  } = {
    useTestSite: false,
    useCache: true,
    getImage: true,
    getFullImageCaption: false,
  }
) {
  const url = new URL(
    useTestSite
      ? "https://md-clone.newspackstaging.com/wp-json/wp/v2/posts"
      : "https://michigandaily.com/wp-json/wp/v2/posts"
  );
  url.searchParams.set("slug", slug);
  url.searchParams.set("_fields", "coauthors,link,title,_links");
  if (!useCache) {
    url.searchParams.set("time", new Date().toISOString());
  }

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Array<WordPressArticle>;
  if (data.length === 0) {
    return null;
  }

  const story = data.at(0);

  if (getImage) {
    const [feature] = story._links["wp:featuredmedia"];

    const params = new URLSearchParams();
    params.set("_fields", "description");

    if (!useCache) {
      params.set("time", new Date().toISOString());
    }

    const imageRequest = await fetch(`${feature.href}?${params.toString()}`);
    const imageData = await imageRequest.json();
    const image = parseImage(imageData.description.rendered, {
      getFullCaption: getFullImageCaption,
    });

    return {
      url: story.link as string,
      title: story.title.rendered as string,
      coauthors: joinListOfStrings(
        story.coauthors.map((author) => author.display_name)
      ),
      image: image,
    };
  }

  return {
    url: story.link as string,
    title: decode(story.title.rendered) as string,
    coauthors: joinListOfStrings(
      story.coauthors.map((author) => author.display_name)
    ),
  };
}

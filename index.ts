import type { HTMLElement } from "node-html-parser";
import { parse } from "node-html-parser";
import he from "he";

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
  {
    getFullCaption,
    useImageLazyLoading,
  }: { getFullCaption?: boolean; useImageLazyLoading?: boolean } = {
    getFullCaption: false,
    useImageLazyLoading: true,
  }
): Image {
  const element = parse(html).querySelector("img")!;

  return {
    html: (useImageLazyLoading
      ? element
      : element.removeAttribute("loading")
    ).toString(),
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

export function parseSlugFromUrl(url: string | undefined | null) {
  if (!!url) {
    return url
      .trim()
      .split("/")
      .filter((part) => part.length > 0)
      .at(-1);
  }

  return undefined;
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

type ImageOptions = {
  getFullCaption?: boolean;
  useCache?: boolean;
  useLazyLoading?: boolean;
};

export async function fetchImageFromSlug(
  slug: string,
  options: ImageOptions = {
    getFullCaption: false,
    useCache: true,
    useLazyLoading: true,
  }
) {
  const url = new URL("https://michigandaily.com/wp-json/wp/v2/media");
  url.searchParams.set("media_type", "image");
  url.searchParams.set("slug", slug);
  url.searchParams.set("_fields", "description");

  if (!options.useCache) {
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

  return parseImage(image.description.rendered, {
    getFullCaption: options.getFullCaption,
    useImageLazyLoading: options.useLazyLoading,
  });
}

export async function fetchImageFromId(
  id: string,
  options: ImageOptions = {
    getFullCaption: false,
    useCache: true,
    useLazyLoading: true,
  }
) {
  const url = new URL("https://michigandaily.com/wp-json/wp/v2/media");
  url.searchParams.set("media_type", "image");
  url.searchParams.set("id", id);
  url.searchParams.set("_fields", "description");

  if (!options.useCache) {
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

  return parseImage(image.description.rendered, {
    getFullCaption: options.getFullCaption,
    useImageLazyLoading: options.useLazyLoading,
  });
}

export async function fetchImageFromUrl(
  url: string,
  options: ImageOptions = {
    getFullCaption: false,
    useCache: true,
    useLazyLoading: true,
  }
) {
  const slug = parseSlugFromUrl(url);
  return await fetchImageFromSlug(slug, options);
}

type PostOptions = {
  useTestSite?: boolean;
  useCache?: boolean;
  getImage?: boolean;
  getImageFullCaption?: boolean;
  useImageLazyLoading?: boolean;
};

export async function fetchPostFromSlug(
  slug: string,
  options: PostOptions = {
    useTestSite: false,
    useCache: true,
    getImage: true,
    getImageFullCaption: false,
    useImageLazyLoading: true,
  }
) {
  const url = new URL(
    options.useTestSite
      ? "https://md-clone.newspackstaging.com/wp-json/wp/v2/posts"
      : "https://michigandaily.com/wp-json/wp/v2/posts"
  );
  url.searchParams.set("slug", slug);
  url.searchParams.set("_fields", "coauthors,link,title,_links");
  if (!options.useCache) {
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

  if (options.getImage) {
    const [feature] = story._links["wp:featuredmedia"];

    const params = new URLSearchParams();
    params.set("_fields", "description");

    if (!options.useCache) {
      params.set("time", new Date().toISOString());
    }

    const imageRequest = await fetch(`${feature.href}?${params.toString()}`);
    const imageData = await imageRequest.json();
    const image = parseImage(imageData.description.rendered, {
      getFullCaption: options.getImageFullCaption,
      useImageLazyLoading: options.useImageLazyLoading,
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
    title: he.decode(story.title.rendered) as string,
    coauthors: joinListOfStrings(
      story.coauthors.map((author) => author.display_name)
    ),
  };
}

export async function fetchPostFromUrl(
  url: string,
  options: PostOptions = {
    useTestSite: false,
    useCache: true,
    getImage: true,
    getImageFullCaption: false,
    useImageLazyLoading: true,
  }
) {
  const slug = parseSlugFromUrl(url);
  return await fetchPostFromSlug(slug, options);
}

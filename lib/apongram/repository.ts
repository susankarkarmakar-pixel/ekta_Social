import AsyncStorage from "@react-native-async-storage/async-storage";
import { commentsByPost, currentUser, demoReels, posts, profiles, topics } from "./mock-data";
import { selectReels } from "./reel-utils";
import { storagePublicUrl, supabaseConfig, supabaseFetch, uploadMedia } from "./supabase";
import { getSupabaseSession } from "./supabase-auth";
import type { Comment, MediaUpload, Post, Profile, VideoCompression, OverlayPosition, OverlaySticker } from "./types";

export const repositoryMode = supabaseConfig.isConfigured ? "supabase" : "demo";
const FEED_CACHE_KEY = "@ekta/feed-cache-v1";
export const FEED_BACKGROUND_SYNC_INTERVAL_MS = 5 * 60 * 1000;

async function readFeedCache(): Promise<Post[]> {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { items?: Post[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function writeFeedCache(items: Post[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), items }));
  } catch {
    // Caching is best effort and must never block the feed.
  }
}

/** Refresh persisted feed data without changing the currently visible feed. */
export async function syncFeedCache(pageSize = 12): Promise<{ items: Post[]; updated: boolean }> {
  const cachedFeed = await readFeedCache();
  const source = !supabaseConfig.isConfigured
    ? posts.filter((post) => !post.isStory)
    : await supabaseFetch<Post[]>(`posts?select=*&order=created_at.desc&limit=${pageSize}`);
  const merged = [...source, ...cachedFeed];
  const unique = [...new Map(merged.map((item) => [item.id, item])).values()];
  const previousSignature = JSON.stringify(cachedFeed);
  const nextSignature = JSON.stringify(unique);
  const updated = previousSignature !== nextSignature;
  if (updated) await writeFeedCache(unique);
  return { items: unique, updated };
}

export async function getFeedPage(page = 0, pageSize = 6): Promise<{ items: Post[]; hasMore: boolean; fromCache: boolean }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  if (!supabaseConfig.isConfigured) {
    const demoFeed = [...posts.filter((post) => !post.isStory), ...demoReels];
    if (page === 0) await writeFeedCache(demoFeed);
    const items = demoFeed.slice(from, to + 1);
    return { items, hasMore: to + 1 < demoFeed.length, fromCache: false };
  }
  const cachedFeed = await readFeedCache();
  try {
    const rows = await supabaseFetch<Post[]>(`posts?select=*&order=created_at.desc&offset=${from}&limit=${pageSize}`);
    const merged = [...(page === 0 ? [] : cachedFeed), ...rows];
    const unique = [...new Map(merged.map((item) => [item.id, item])).values()];
    await writeFeedCache(unique);
    return { items: rows, hasMore: rows.length === pageSize, fromCache: false };
  } catch {
    const source = cachedFeed.length ? cachedFeed : posts;
    const items = source.slice(from, to + 1);
    return { items, hasMore: to + 1 < source.length, fromCache: true };
  }
}

export async function getCachedFeedPage(page = 0, pageSize = 6): Promise<{ items: Post[]; hasMore: boolean; fromCache: true }> {
  const cachedFeed = await readFeedCache();
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const items = cachedFeed.slice(from, to + 1);
  return { items, hasMore: to + 1 < cachedFeed.length, fromCache: true };
}

export async function getFeed(): Promise<Post[]> {
  if (!supabaseConfig.isConfigured) return posts.filter((post) => !post.isStory);
  try {
    const rows = await supabaseFetch<Post[]>("posts?select=*&order=created_at.desc");
    return rows.length ? rows : posts.filter((post) => !post.isStory);
  } catch {
    return posts.filter((post) => !post.isStory);
  }
}

export async function getReels(): Promise<Post[]> {
  const localReels = selectReels([...posts, ...demoReels]);
  if (!supabaseConfig.isConfigured) return localReels;

  try {
    const rows = await supabaseFetch<ReelRow[]>(
      "posts?select=id,body,video_path,is_story,created_at,location,author:profiles(id,name,handle,bio,avatar_path,region,pronouns,website,category)&video_path=not.is.null&is_story=eq.false&order=created_at.desc",
    );
    const remoteReels = rows.map(toReel).filter((reel): reel is Post => Boolean(reel));
    const unique = new Map<string, Post>();
    for (const reel of [...localReels, ...remoteReels]) unique.set(reel.id, reel);
    return selectReels([...unique.values()]);
  } catch {
    return localReels;
  }
}

type ReelRow = {
  id?: string;
  body?: string;
  video_path?: string | null;
  is_story?: boolean | null;
  created_at?: string | null;
  location?: string | null;
  author_id?: string | null;
  author?: {
    id?: string;
    name?: string | null;
    handle?: string | null;
    bio?: string | null;
    avatar_path?: string | null;
    region?: string | null;
    pronouns?: string | null;
    website?: string | null;
    category?: Profile["category"] | null;
  } | null;
};

function toReel(row: ReelRow): Post | null {
  if (!row.id || !row.body || !row.video_path || row.is_story) return null;
  const videoUrl = /^https?:\/\//i.test(row.video_path)
    ? row.video_path
    : storagePublicUrl("community-media", row.video_path);
  if (!videoUrl) return null;

  const remoteAuthor = row.author;
  const author: Profile = remoteAuthor?.id && remoteAuthor.name && remoteAuthor.handle
    ? {
        id: remoteAuthor.id,
        name: remoteAuthor.name,
        handle: remoteAuthor.handle,
        bio: remoteAuthor.bio ?? "",
        initials: remoteAuthor.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
        avatarColor: "#365C57",
        avatarUrl: remoteAuthor.avatar_path?.startsWith("http") ? remoteAuthor.avatar_path : undefined,
        region: remoteAuthor.region ?? "India",
        pronouns: remoteAuthor.pronouns ?? undefined,
        website: remoteAuthor.website ?? undefined,
        category: remoteAuthor.category ?? undefined,
        followers: 0,
        following: 0,
      }
    : currentUser;

  return {
    id: row.id,
    author,
    body: row.body,
    videoUrl,
    mediaType: "video",
    videoAspectRatio: "9:16",
    isStory: false,
    createdAt: row.created_at ?? "recently",
    location: row.location ?? author.region,
    tags: row.body.match(/#[\p{L}\d_]+/gu) ?? [],
    likes: 0,
    comments: 0,
    likedByMe: false,
  };
}

export async function searchCommunity(query: string): Promise<{ people: Profile[]; posts: Post[]; topics: string[] }> {
  const term = query.trim().toLowerCase().replace(/^#/, "");
  if (!term) return { people: profiles.slice(1), posts: posts.slice(0, 2), topics };
  return {
    people: profiles.filter((profile) => `${profile.name} ${profile.handle} ${profile.region}`.toLowerCase().includes(term)),
    posts: posts.filter((post) => `${post.body} ${post.tags.join(" ")}`.toLowerCase().includes(term)),
    topics: topics.filter((topic) => topic.toLowerCase().includes(term)),
  };
}

export async function getPost(id: string): Promise<Post | undefined> {
  return posts.find((post) => post.id === id);
}

export async function getComments(postId: string): Promise<Comment[]> {
  return commentsByPost[postId] ?? [];
}

export async function addComment(postId: string, body: string): Promise<Comment> {
  const comment: Comment = { id: `local-comment-${Date.now()}`, author: currentUser, body, createdAt: "now" };
  (commentsByPost[postId] ??= []).push(comment);
  const post = posts.find((item) => item.id === postId);
  if (post) post.comments += 1;
  return comment;
}

export async function createPost(body: string, imagePath?: string, videoPath?: string, isStory = false, videoOptions?: { start: number; end: number; compression: VideoCompression; aspectRatio?: "9:16" }, musicOptions?: { trackId: string; musicVolume: number; originalVolume: number }, overlayOptions?: { text?: string; sticker?: OverlaySticker; position: OverlayPosition }): Promise<Post> {
  const hasLocalMedia = [imagePath, videoPath].some((path) => path && /^(file:|content:|blob:)/i.test(path));
  let uploadedMedia: MediaUpload | undefined;
  let durableImagePath = imagePath;
  let durableVideoPath = videoPath;
  let sessionUserId: string | undefined;

  if (supabaseConfig.isConfigured) {
    const session = await getSupabaseSession();
    sessionUserId = session?.user.id;
    if (!sessionUserId) throw new Error("Sign in before publishing to the community");
    if (hasLocalMedia && imagePath && /^(file:|content:|blob:)/i.test(imagePath)) {
      uploadedMedia = await uploadMedia(imagePath, sessionUserId, "image");
      durableImagePath = uploadedMedia.path;
    }
    if (hasLocalMedia && videoPath && /^(file:|content:|blob:)/i.test(videoPath)) {
      uploadedMedia = await uploadMedia(videoPath, sessionUserId, "video");
      durableVideoPath = uploadedMedia.path;
    }
  }

  const post: Post = {
    id: `local-${Date.now()}`,
    author: currentUser,
    body,
    imageUrl: uploadedMedia?.bucket && durableImagePath ? storagePublicUrl(uploadedMedia.bucket, durableImagePath) : durableImagePath,
    videoUrl: uploadedMedia?.bucket && durableVideoPath ? storagePublicUrl(uploadedMedia.bucket, durableVideoPath) : durableVideoPath,
    mediaType: durableVideoPath ? "video" : durableImagePath ? "image" : undefined,
    videoStart: videoOptions?.start,
    videoEnd: videoOptions?.end,
    videoAspectRatio: videoOptions?.aspectRatio,
    videoCompression: videoOptions?.compression,
    musicTrackId: musicOptions?.trackId,
    musicVolume: musicOptions?.musicVolume,
    originalVolume: musicOptions?.originalVolume,
    overlayText: overlayOptions?.text,
    overlaySticker: overlayOptions?.sticker,
    overlayPosition: overlayOptions?.position,
    isStory,
    storyExpiresAt: isStory ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
    createdAt: "now",
    location: currentUser.region,
    tags: body.match(/#[\p{L}\d_]+/gu) ?? [],
    likes: 0,
    comments: 0,
    likedByMe: false,
  };

  if (supabaseConfig.isConfigured) {
    await supabaseFetch("posts", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        author_id: sessionUserId,
        body,
        image_path: durableImagePath ?? null,
        video_path: durableVideoPath ?? null,
        media_mime_type: uploadedMedia?.mimeType ?? null,
        media_size_bytes: uploadedMedia?.sizeBytes ?? null,
        render_status: "ready",
        render_manifest: { trim_start: videoOptions?.start ?? null, trim_end: videoOptions?.end ?? null, aspect_ratio: videoOptions?.aspectRatio ?? null, compression: videoOptions?.compression ?? null, music_track_id: musicOptions?.trackId ?? null, music_volume: musicOptions?.musicVolume ?? null, original_volume: musicOptions?.originalVolume ?? null, overlay_text: overlayOptions?.text ?? null, overlay_sticker: overlayOptions?.sticker ?? null, overlay_position: overlayOptions?.position ?? null },
        is_story: isStory,
      }),
    });
  }
  posts.unshift(post);
  return post;
}

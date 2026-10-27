import AsyncStorage from "@react-native-async-storage/async-storage";
import { currentUser, profiles } from "./mock-data";
import { getSupabaseAccessToken, getSupabaseSession } from "./supabase-auth";
import { storagePublicUrl, supabaseConfig, supabaseFetch } from "./supabase";
import type { Profile } from "./types";

const STORAGE_KEY = "@ekta/messages-v1";
const QUEUE_KEY = "@ekta/messages-outbox-v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MessageSyncStatus = "local" | "pending" | "synced" | "failed";

export type DirectMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  read: boolean;
  syncStatus?: MessageSyncStatus;
};

export type MessageThread = {
  id: string;
  participantId: string;
  messages: DirectMessage[];
  updatedAt: string;
};

type OutboxItem = {
  id: string;
  participantId: string;
  localMessageId: string;
  body: string;
  createdAt: string;
  retryCount: number;
};

type RemoteMessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const seedThreads: MessageThread[] = [
  {
    id: "thread-p-1",
    participantId: "p-1",
    updatedAt: "10 min",
    messages: [
      { id: "dm-1", senderId: "p-1", body: "হাটের রাস্তার কাজ নিয়ে নতুন আপডেট পেয়েছি।", createdAt: "10 min", read: false, syncStatus: "local" },
      { id: "dm-2", senderId: currentUser.id, body: "ধন্যবাদ, community-র সঙ্গে শেয়ার করব।", createdAt: "8 min", read: true, syncStatus: "local" },
    ],
  },
  {
    id: "thread-p-2",
    participantId: "p-2",
    updatedAt: "গতকাল",
    messages: [
      { id: "dm-3", senderId: "p-2", body: "বই বিনিময়ের আয়োজনটি শনিবার হবে তো?", createdAt: "গতকাল", read: true, syncStatus: "local" },
    ],
  },
];

function sanitizeThreads(value: unknown): MessageThread[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MessageThread => {
    if (!item || typeof item !== "object") return false;
    const thread = item as MessageThread;
    return typeof thread.id === "string" && typeof thread.participantId === "string" && Array.isArray(thread.messages);
  });
}

async function readThreads(): Promise<MessageThread[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return seedThreads;
    return sanitizeThreads(JSON.parse(raw));
  } catch {
    return seedThreads;
  }
}

async function writeThreads(threads: MessageThread[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch {
    // Messaging remains usable in memory when local storage is unavailable.
  }
}

async function readOutbox(): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeOutbox(items: OutboxItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Queue persistence is best effort; the optimistic message stays visible.
  }
}

function canUseRemote(participantId: string, userId?: string): boolean {
  return Boolean(supabaseConfig.isConfigured && userId && UUID_RE.test(userId) && UUID_RE.test(participantId));
}

export function isRemoteMessagingConfigured(): boolean {
  return supabaseConfig.isConfigured;
}

export function getMessageParticipant(id: string): Profile | undefined {
  return profiles.find((profile) => profile.id === id);
}

function toLocalMessage(row: RemoteMessageRow, userId: string): DirectMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    read: row.sender_id === userId || Boolean(row.read_at),
    syncStatus: "synced",
  };
}

async function getRemoteMessages(participantId: string): Promise<MessageThread | null> {
  const session = await getSupabaseSession();
  const userId = session?.user.id;
  if (!userId || !canUseRemote(participantId, userId)) return null;
  const filter = `or=(and(sender_id.eq.${userId},recipient_id.eq.${participantId}),and(sender_id.eq.${participantId},recipient_id.eq.${userId}))`;
  const rows = await supabaseFetch<RemoteMessageRow[]>(`direct_messages?select=id,sender_id,recipient_id,body,created_at,read_at&${filter}&order=created_at.asc`);
  return {
    id: `thread-${participantId}`,
    participantId,
    messages: rows.map((row) => toLocalMessage(row, userId)),
    updatedAt: rows.at(-1)?.created_at ?? "now",
  };
}

function mergeMessages(local: DirectMessage[], remote: DirectMessage[]): DirectMessage[] {
  const merged = new Map<string, DirectMessage>();
  for (const message of [...local, ...remote]) merged.set(message.id, message);
  return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function persistThread(thread: MessageThread): Promise<void> {
  const threads = await readThreads();
  const existing = threads.find((item) => item.participantId === thread.participantId);
  const next = existing
    ? threads.map((item) => item.participantId === thread.participantId ? { ...thread, messages: mergeMessages(item.messages, thread.messages) } : item)
    : [thread, ...threads];
  await writeThreads(next);
}

export async function getMessageThreads(): Promise<MessageThread[]> {
  const threads = await readThreads();
  return [...threads].sort((a, b) => b.messages.length - a.messages.length || b.updatedAt.localeCompare(a.updatedAt));
}

export async function getMessageThread(participantId: string): Promise<MessageThread> {
  const local = (await readThreads()).find((thread) => thread.participantId === participantId) ?? {
    id: `thread-${participantId}`,
    participantId,
    messages: [],
    updatedAt: "now",
  };
  try {
    const remote = await getRemoteMessages(participantId);
    if (!remote) return local;
    const merged = { ...remote, messages: mergeMessages(local.messages, remote.messages) };
    await persistThread(merged);
    return merged;
  } catch {
    return local;
  }
}

async function insertRemoteMessage(participantId: string, body: string): Promise<DirectMessage> {
  const session = await getSupabaseSession();
  const userId = session?.user.id;
  if (!userId || !canUseRemote(participantId, userId)) throw new Error("Remote messaging is not available for this participant");
  const rows = await supabaseFetch<RemoteMessageRow[]>("direct_messages", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ sender_id: userId, recipient_id: participantId, body }),
  });
  const row = rows[0];
  if (!row) throw new Error("Message was not acknowledged by Supabase");
  return toLocalMessage(row, userId);
}

async function enqueueMessage(item: OutboxItem): Promise<void> {
  const queue = await readOutbox();
  if (!queue.some((queued) => queued.id === item.id)) await writeOutbox([...queue, item]);
}

async function replaceLocalMessage(participantId: string, localId: string, message: DirectMessage): Promise<void> {
  const threads = await readThreads();
  await writeThreads(threads.map((thread) => thread.participantId === participantId
    ? { ...thread, messages: thread.messages.map((item) => item.id === localId ? message : item), updatedAt: message.createdAt }
    : thread));
}

export async function sendDirectMessage(participantId: string, body: string): Promise<DirectMessage> {
  const trimmed = body.trim();
  const localMessage: DirectMessage = {
    id: `local-dm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    senderId: currentUser.id,
    body: trimmed,
    createdAt: new Date().toISOString(),
    read: true,
    syncStatus: "pending",
  };
  const threads = await readThreads();
  const existing = threads.find((thread) => thread.participantId === participantId);
  const nextThread = existing
    ? { ...existing, messages: [...existing.messages, localMessage], updatedAt: localMessage.createdAt }
    : { id: `thread-${participantId}`, participantId, messages: [localMessage], updatedAt: localMessage.createdAt };
  await writeThreads(existing ? threads.map((thread) => thread.participantId === participantId ? nextThread : thread) : [nextThread, ...threads]);

  const session = await getSupabaseSession();
  if (!canUseRemote(participantId, session?.user.id)) return { ...localMessage, syncStatus: "local" };
  try {
    const remote = await insertRemoteMessage(participantId, trimmed);
    await replaceLocalMessage(participantId, localMessage.id, remote);
    return remote;
  } catch {
    await enqueueMessage({ id: localMessage.id, participantId, localMessageId: localMessage.id, body: trimmed, createdAt: localMessage.createdAt, retryCount: 0 });
    return localMessage;
  }
}

export async function flushMessageQueue(): Promise<{ flushed: number; pending: number }> {
  const queue = await readOutbox();
  if (!queue.length) return { flushed: 0, pending: 0 };
  let flushed = 0;
  const pending: OutboxItem[] = [];
  for (const item of queue) {
    try {
      const remote = await insertRemoteMessage(item.participantId, item.body);
      await replaceLocalMessage(item.participantId, item.localMessageId, remote);
      flushed += 1;
    } catch {
      pending.push({ ...item, retryCount: item.retryCount + 1 });
    }
  }
  await writeOutbox(pending);
  return { flushed, pending: pending.length };
}

export async function persistIncomingDirectMessage(message: DirectMessage): Promise<void> {
  const threads = await readThreads();
  const existing = threads.find((thread) => thread.participantId === message.senderId);
  if (existing && existing.messages.some((item) => item.id === message.id)) return;
  const nextThread: MessageThread = existing
    ? { ...existing, messages: [...existing.messages, message], updatedAt: message.createdAt }
    : { id: `thread-${message.senderId}`, participantId: message.senderId, messages: [message], updatedAt: message.createdAt };
  await writeThreads(existing
    ? threads.map((thread) => thread.participantId === message.senderId ? nextThread : thread)
    : [nextThread, ...threads]);
}

export async function markMessageThreadRead(participantId: string): Promise<void> {
  const threads = await readThreads();
  await writeThreads(threads.map((thread) => thread.participantId === participantId
    ? { ...thread, messages: thread.messages.map((message) => message.senderId === participantId ? { ...message, read: true } : message) }
    : thread));
  const session = await getSupabaseSession();
  const userId = session?.user.id;
  if (!userId || !canUseRemote(participantId, userId)) return;
  try {
    await supabaseFetch(`direct_messages?sender_id=eq.${participantId}&recipient_id=eq.${userId}&read_at=is.null`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ read_at: new Date().toISOString() }),
    });
  } catch {
    // Local read state is retained and will be reconciled on the next fetch.
  }
}

export { storagePublicUrl };

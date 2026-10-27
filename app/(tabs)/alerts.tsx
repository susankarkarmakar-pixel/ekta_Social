import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/apongram/Avatar";
import { Colors } from "@/constants/theme";
import { profiles } from "@/lib/apongram/mock-data";
import { getInAppNotifications, markAllInAppNotificationsRead, markInAppNotificationRead, type InAppNotification } from "@/lib/apongram/notifications";
import { useLanguage } from "@/lib/apongram/LanguageContext";

const C = Colors.light;
const iconFor: Record<InAppNotification["kind"], "favorite" | "chat-bubble-outline" | "person-add-alt-1" | "mail-outline"> = { message: "mail-outline", follow: "person-add-alt-1", comment: "chat-bubble-outline", like: "favorite" };

export default function AlertsScreen() {
  const router = useRouter();
  const { language, copy } = useLanguage();
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [readAll, setReadAll] = useState(false);
  const bodyFont = language === "bn" ? "HindSiliguri" : "HindSiliguriLatin";
  const mediumFont = language === "bn" ? "HindSiliguriSemiBold" : "HindSiliguriLatinSemiBold";
  const headingFont = language === "bn" ? "NotoSerifBengaliBold" : "Fraunces";

  const load = useCallback(() => { void getInAppNotifications().then(setItems); }, []);
  useFocusEffect(useCallback(() => { load(); setReadAll(false); }, [load]));

  const openItem = async (item: InAppNotification) => {
    await markInAppNotificationRead(item.id);
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
    if (item.route === "/messages/[id]" && item.routeParam) router.push({ pathname: "/messages/[id]" as never, params: { id: item.routeParam } });
    else if (item.route === "/post/[id]" && item.routeParam) router.push({ pathname: "/post/[id]", params: { id: item.routeParam } });
    else if (item.routeParam) router.push({ pathname: "/(tabs)/profile", params: { id: item.routeParam } });
  };

  const markRead = async () => { await markAllInAppNotificationsRead(); setReadAll(true); setItems((current) => current.map((item) => ({ ...item, read: true }))); };
  const today = items.filter((item) => !item.read && !readAll);
  const earlier = items.filter((item) => item.read || readAll);
  const renderItem = (item: InAppNotification) => {
    const actor = profiles.find((profile) => profile.id === item.actorId) ?? profiles[0];
    const unread = !item.read && !readAll;
    return <Pressable key={item.id} onPress={() => void openItem(item)} style={[styles.row, unread && styles.unread]}><View style={styles.avatarWrap}><Avatar profile={actor} size={44} /><View style={[styles.typeBadge, item.kind === "follow" ? styles.followBadge : item.kind === "message" ? styles.messageBadge : item.kind === "comment" ? styles.commentBadge : styles.likeBadge]}><MaterialIcons name={iconFor[item.kind]} size={11} color="#FFF" /></View></View><View style={styles.rowCopy}><Text style={[styles.message, { fontFamily: bodyFont }]}><Text style={[styles.name, { fontFamily: mediumFont }]}>{actor.name}</Text>{" "}{language === "bn" ? item.body : englishBody(item.kind)}</Text><Text style={[styles.time, { fontFamily: bodyFont }]}>{formatTime(item.createdAt, language === "bn")}</Text></View>{unread ? <View style={styles.unreadDot} /> : null}</Pressable>;
  };

  return <View style={styles.root}><ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel={language === "bn" ? "ফিরে যান" : "Go back"}><MaterialIcons name="arrow-back" size={22} color={C.inkNavy} /></Pressable><Text style={[styles.title, { fontFamily: headingFont }]}>{copy.alerts}</Text><Pressable onPress={() => void markRead()} style={styles.markRead}><Text style={[styles.markReadText, { fontFamily: mediumFont }]}>{language === "bn" ? "সব পড়া হয়েছে" : "Mark all read"}</Text></Pressable></View>{today.length ? <><Text style={[styles.groupLabel, { fontFamily: bodyFont }]}>{language === "bn" ? "আজ" : "Today"}</Text><View style={styles.list}>{today.map(renderItem)}</View></> : null}{earlier.length ? <><Text style={[styles.groupLabel, { fontFamily: bodyFont }]}>{language === "bn" ? "আগের" : "Earlier"}</Text><View style={styles.list}>{earlier.map(renderItem)}</View></> : null}{!items.length ? <View style={styles.empty}><View style={styles.emptyIcon}><MaterialIcons name="notifications-none" size={42} color={C.terracotta} /></View><Text style={[styles.emptyTitle, { fontFamily: headingFont }]}>{language === "bn" ? "কোনো বিজ্ঞপ্তি নেই" : "No notifications yet"}</Text><Text style={[styles.emptyText, { fontFamily: bodyFont }]}>{language === "bn" ? "নতুন message বা follower update এখানে দেখা যাবে।" : "New messages and follower updates will show up here."}</Text></View> : null}<Text style={[styles.note, { fontFamily: bodyFont }]}>{language === "bn" ? "Push বন্ধ থাকলেও in-app বিজ্ঞপ্তি এখানে সংরক্ষিত থাকবে।" : "In-app alerts remain available even when push is turned off."}</Text></ScrollView></View>;
}

function englishBody(kind: InAppNotification["kind"]): string { return kind === "message" ? "sent you a message" : kind === "follow" ? "started following you" : kind === "comment" ? "commented on your post" : "liked your post"; }
function formatTime(value: string, bn: boolean): string { if (!value.includes("T")) return value; const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000)); return bn ? `${minutes} মিনিট আগে` : `${minutes} min ago`; }

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: C.ivory }, container: { paddingHorizontal: 16, paddingBottom: 30 }, header: { flexDirection: "row", alignItems: "center", height: 64, gap: 4 }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, title: { flex: 1, color: C.inkNavy, fontSize: 21 }, markRead: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }, markReadText: { color: C.leafGreen, fontSize: 11, fontWeight: "800" }, groupLabel: { color: C.slate, fontSize: 12, fontWeight: "700", marginTop: 7, marginBottom: 7 }, list: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: "hidden" }, row: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.line }, unread: { backgroundColor: C.primaryContainer }, avatarWrap: { position: "relative" }, typeBadge: { position: "absolute", right: -5, bottom: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#FFFDF8", alignItems: "center", justifyContent: "center" }, likeBadge: { backgroundColor: "#B4492A" }, followBadge: { backgroundColor: "#2E6B4A" }, commentBadge: { backgroundColor: C.inkNavy }, messageBadge: { backgroundColor: "#7A5B27" }, rowCopy: { flex: 1 }, message: { color: C.inkNavy, fontSize: 13, lineHeight: 19 }, name: { fontWeight: "800" }, time: { color: C.slate, fontSize: 11, marginTop: 3 }, unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.terracotta }, empty: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 100 }, emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.primaryContainer, alignItems: "center", justifyContent: "center" }, emptyTitle: { color: C.inkNavy, fontSize: 23, marginTop: 24 }, emptyText: { color: C.slate, fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 8 }, note: { color: C.slate, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 16 }, });

import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/apongram/Avatar";
import { ScreenContainer } from "@/components/screen-container";
import { Colors } from "@/constants/theme";
import { currentUser } from "@/lib/apongram/mock-data";
import { getMessageParticipant, getMessageThreads, type MessageThread } from "@/lib/apongram/messages";
import { useLanguage } from "@/lib/apongram/LanguageContext";

const C = Colors.light;

export default function MessagesScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const bodyFont = language === "bn" ? "HindSiliguri" : "HindSiliguriLatin";
  const mediumFont = language === "bn" ? "HindSiliguriSemiBold" : "HindSiliguriLatinSemiBold";
  const headingFont = language === "bn" ? "NotoSerifBengaliBold" : "Fraunces";

  const loadThreads = useCallback(() => {
    void getMessageThreads().then(setThreads);
  }, []);
  useFocusEffect(useCallback(() => { loadThreads(); }, [loadThreads]));

  const unreadCount = threads.reduce((total, thread) => total + thread.messages.filter((message) => message.senderId !== currentUser.id && !message.read).length, 0);

  return (
    <ScreenContainer safeAreaClassName="bg-background" className="bg-background">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel={language === "bn" ? "ফিরে যান" : "Go back"}>
            <MaterialIcons name="arrow-back" size={22} color={C.inkNavy} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { fontFamily: headingFont }]}>{language === "bn" ? "বার্তা" : "Messages"}</Text>
            <Text style={[styles.subtitle, { fontFamily: bodyFont }]}>{unreadCount ? (language === "bn" ? `${unreadCount}টি নতুন বার্তা` : `${unreadCount} unread`) : (language === "bn" ? "আপনার ব্যক্তিগত কথোপকথন" : "Your private conversations")}</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/discover")} style={styles.composeButton} accessibilityLabel={language === "bn" ? "নতুন বার্তা শুরু করুন" : "Start a new message"}>
            <MaterialIcons name="edit" size={19} color={C.terracotta} />
          </Pressable>
        </View>
        <View style={styles.privacyNote}>
          <MaterialIcons name="lock-outline" size={16} color={C.leafGreen} />
          <Text style={[styles.privacyText, { fontFamily: bodyFont }]}>{language === "bn" ? "আপনার message শুধু প্রাপক দেখতে পারবেন।" : "Only you and the recipient can see these messages."}</Text>
        </View>
        {threads.length ? <View style={styles.list}>{threads.map((thread) => {
          const participant = getMessageParticipant(thread.participantId);
          if (!participant) return null;
          const last = thread.messages[thread.messages.length - 1];
          const unread = thread.messages.some((message) => message.senderId !== currentUser.id && !message.read);
          return (
            <Pressable key={thread.id} onPress={() => router.push({ pathname: "/messages/[id]" as never, params: { id: participant.id } })} style={[styles.row, unread && styles.unreadRow]} accessibilityRole="button">
              <Avatar profile={participant} size={48} />
              <View style={styles.rowCopy}>
                <View style={styles.rowTop}><Text style={[styles.name, { fontFamily: mediumFont }]}>{participant.name}</Text><Text style={[styles.time, { fontFamily: bodyFont }]}>{thread.updatedAt}</Text></View>
                <Text numberOfLines={1} style={[styles.preview, { fontFamily: bodyFont }]}>{last?.senderId === currentUser.id ? `${language === "bn" ? "আপনি: " : "You: "}${last.body}` : last?.body}</Text>
              </View>
              {unread ? <View style={styles.unreadDot} /> : <MaterialIcons name="chevron-right" size={20} color={C.slate} />}
            </Pressable>
          );
        })}</View> : <View style={styles.empty}><View style={styles.emptyIcon}><MaterialIcons name="forum" size={36} color={C.terracotta} /></View><Text style={[styles.emptyTitle, { fontFamily: headingFont }]}>{language === "bn" ? "এখনও কোনও message নেই" : "No messages yet"}</Text><Text style={[styles.emptyBody, { fontFamily: bodyFont }]}>{language === "bn" ? "কোনও profile খুলে Message চাপুন।" : "Open a profile and tap Message to start a conversation."}</Text><Pressable onPress={() => router.push("/(tabs)/discover")} style={styles.discoverButton}><Text style={[styles.discoverButtonText, { fontFamily: mediumFont }]}>{language === "bn" ? "মানুষ খুঁজুন" : "Find people"}</Text></Pressable></View>}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 30 },
  header: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  title: { color: C.inkNavy, fontSize: 23, fontWeight: "700" },
  subtitle: { color: C.slate, fontSize: 12, marginTop: 2 },
  composeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primaryContainer, alignItems: "center", justifyContent: "center" },
  privacyNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.primaryContainer, borderRadius: 14, padding: 12, marginBottom: 14 },
  privacyText: { flex: 1, color: C.leafGreen, fontSize: 11 },
  list: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 18, overflow: "hidden" },
  row: { minHeight: 76, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  unreadRow: { backgroundColor: C.primaryContainer },
  rowCopy: { flex: 1 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { color: C.inkNavy, fontSize: 14, fontWeight: "800" },
  time: { color: C.slate, fontSize: 10 },
  preview: { color: C.slate, fontSize: 12, marginTop: 4 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.terracotta },
  empty: { alignItems: "center", paddingVertical: 100, paddingHorizontal: 25 },
  emptyIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: C.primaryContainer, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: C.inkNavy, fontSize: 21, marginTop: 20 },
  emptyBody: { color: C.slate, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 7 },
  discoverButton: { backgroundColor: C.terracotta, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 13, marginTop: 22 },
  discoverButtonText: { color: C.ivory, fontSize: 13, fontWeight: "800" },
});

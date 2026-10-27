import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "@/components/apongram/Avatar";
import { ScreenContainer } from "@/components/screen-container";
import { Colors } from "@/constants/theme";
import { currentUser } from "@/lib/apongram/mock-data";
import { flushMessageQueue, getMessageParticipant, getMessageThread, markMessageThreadRead, sendDirectMessage, type DirectMessage } from "@/lib/apongram/messages";
import { subscribeToIncomingMessages } from "@/lib/apongram/message-realtime";
import { useLanguage } from "@/lib/apongram/LanguageContext";

const C = Colors.light;

export default function MessageThreadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const participantId = typeof id === "string" ? id : "";
  const participant = useMemo(() => getMessageParticipant(participantId), [participantId]);
  const { language } = useLanguage();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [body, setBody] = useState("");
  const [syncing, setSyncing] = useState(false);
  const bodyFont = language === "bn" ? "HindSiliguri" : "HindSiliguriLatin";
  const mediumFont = language === "bn" ? "HindSiliguriSemiBold" : "HindSiliguriLatinSemiBold";

  useEffect(() => {
    if (!participantId) return;
    void getMessageThread(participantId).then((thread) => setMessages(thread.messages));
    void markMessageThreadRead(participantId);
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void flushMessageQueue().then(() => getMessageThread(participantId)).then((thread) => {
      if (active) setMessages(thread.messages);
    });
    void subscribeToIncomingMessages((message) => {
      if (active && message.senderId === participantId) {
        setMessages((items) => items.some((item) => item.id === message.id) ? items : [...items, message]);
        void markMessageThreadRead(participantId);
      }
    }).then((cleanup) => {
      if (active) unsubscribe = cleanup;
      else cleanup();
    });
    const appState = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      void flushMessageQueue().then(() => getMessageThread(participantId)).then((thread) => {
        if (active) setMessages(thread.messages);
      });
    });
    return () => {
      active = false;
      unsubscribe?.();
      appState.remove();
    };
  }, [participantId]);

  const send = async () => {
    if (!body.trim() || !participantId) return;
    setSyncing(true);
    const message = await sendDirectMessage(participantId, body);
    setMessages((items) => [...items, message]);
    setBody("");
    setSyncing(false);
  };

  if (!participant) {
    return <ScreenContainer safeAreaClassName="bg-background" className="bg-background"><View style={styles.invalid}><Text style={[styles.invalidText, { fontFamily: bodyFont }]}>{language === "bn" ? "এই profile পাওয়া যায়নি।" : "This profile could not be found."}</Text></View></ScreenContainer>;
  }

  return (
    <ScreenContainer safeAreaClassName="bg-background" className="bg-background">
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel={language === "bn" ? "ফিরে যান" : "Go back"}><MaterialIcons name="arrow-back" size={22} color={C.inkNavy} /></Pressable>
          <Avatar profile={participant} size={40} />
          <View style={styles.headerCopy}><Text style={[styles.name, { fontFamily: mediumFont }]}>{participant.name}</Text><Text style={[styles.handle, { fontFamily: bodyFont }]}>@{participant.handle} · {participant.region}</Text></View>
          <Pressable onPress={() => router.push({ pathname: "/(tabs)/profile", params: { id: participant.id } })} style={styles.iconButton} accessibilityLabel={language === "bn" ? "Profile দেখুন" : "View profile"}><MaterialIcons name="person-outline" size={22} color={C.inkNavy} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}><View style={styles.introAvatar}><Avatar profile={participant} size={56} /></View><Text style={[styles.introTitle, { fontFamily: mediumFont }]}>{participant.name}</Text><Text style={[styles.introText, { fontFamily: bodyFont }]}>{language === "bn" ? "এই conversation শুধু আপনারা দুজন দেখতে পারবেন।" : "Only you and this person can see this conversation."}</Text></View>
          {messages.map((message) => {
            const mine = message.senderId === currentUser.id;
            return <View key={message.id} style={[styles.messageRow, mine && styles.messageRowMine]}><View style={[styles.bubble, mine ? styles.myBubble : styles.theirBubble]}><Text style={[styles.bubbleText, mine && styles.myBubbleText, { fontFamily: bodyFont }]}>{message.body}</Text><Text style={[styles.messageTime, mine && styles.myMessageTime, { fontFamily: bodyFont }]}>{message.syncStatus === "pending" ? (language === "bn" ? "অফলাইনে রাখা হয়েছে" : "Queued offline") : message.createdAt}</Text></View></View>;
          })}
        </ScrollView>
        <View style={styles.composer}><TextInput value={body} onChangeText={setBody} placeholder={syncing ? (language === "bn" ? "message sync হচ্ছে…" : "Syncing message…") : language === "bn" ? "একটি message লিখুন…" : "Write a message…"} placeholderTextColor={C.slate} style={[styles.input, { fontFamily: bodyFont }]} multiline maxLength={500} onSubmitEditing={() => { if (Platform.OS === "web") void send(); }} /><Pressable onPress={() => void send()} disabled={!body.trim() || syncing} style={[styles.sendButton, (!body.trim() || syncing) && styles.sendDisabled]} accessibilityLabel={language === "bn" ? "Message পাঠান" : "Send message"}><MaterialIcons name="send" size={19} color={C.ivory} /></Pressable></View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 70, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  name: { color: C.inkNavy, fontSize: 15, fontWeight: "800" },
  handle: { color: C.slate, fontSize: 11, marginTop: 2 },
  messages: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 18, flexGrow: 1 },
  intro: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 30 },
  introAvatar: { borderRadius: 32, padding: 3, backgroundColor: C.primaryContainer },
  introTitle: { color: C.inkNavy, fontSize: 18, marginTop: 10 },
  introText: { color: C.slate, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 4 },
  messageRow: { flexDirection: "row", justifyContent: "flex-start", marginBottom: 10 },
  messageRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  theirBubble: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 5 },
  myBubble: { backgroundColor: C.terracotta, borderBottomRightRadius: 5 },
  bubbleText: { color: C.inkNavy, fontSize: 14, lineHeight: 20 },
  myBubbleText: { color: C.ivory },
  messageTime: { color: C.slate, fontSize: 9, marginTop: 4 },
  myMessageTime: { color: "rgba(255,255,255,0.68)", textAlign: "right" },
  composer: { margin: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 25, paddingLeft: 15, paddingRight: 6, minHeight: 50, maxHeight: 110, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, color: C.inkNavy, fontSize: 14, maxHeight: 90, paddingVertical: 10 },
  sendButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.terracotta, alignItems: "center", justifyContent: "center" },
  sendDisabled: { backgroundColor: C.slate },
  invalid: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  invalidText: { color: C.slate, fontSize: 15 },
});

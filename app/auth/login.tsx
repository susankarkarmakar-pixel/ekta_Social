import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandWaves } from "@/components/brand/BrandWaves";
import { ScreenContainer } from "@/components/screen-container";
import { Colors } from "@/constants/theme";
import { isValidEmailAddress } from "@/lib/apongram/email-validation";
import { getStoredProfile, syncProfileToSupabase } from "@/lib/apongram/profile-store";
import { completeGoogleOAuthRedirect, getGoogleOAuthUrl, getSupabaseAccessToken, resendSignupVerification, signInWithEmail, signUpWithEmail } from "@/lib/apongram/supabase-auth";
import { supabaseConfig } from "@/lib/apongram/supabase-config";
import { useLanguage } from "@/lib/apongram/LanguageContext";

const C = Colors.light;
type AuthMode = "signin" | "signup";
type BusyAction = "google" | "email" | "resend" | null;

export default function LoginScreen() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const bodyFont = language === "bn" ? "HindSiliguri" : "HindSiliguriLatin";
  const mediumFont = language === "bn" ? "HindSiliguriSemiBold" : "HindSiliguriLatinSemiBold";
  const headingFont = language === "bn" ? "NotoSerifBengaliBold" : "Fraunces";
  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = isValidEmailAddress(normalizedEmail);
  const validPassword = password.length >= 8;
  const canSubmit = validEmail && validPassword && (mode === "signin" || name.trim().length >= 2);
  const busy = busyAction !== null;
  const configurationMessage = language === "bn" ? "বাস্তব sign-in চালাতে Supabase URL ও publishable key configure করুন।" : "Live sign-in needs the Supabase URL and publishable key.";

  useEffect(() => {
    let active = true;
    void getSupabaseAccessToken().then((token) => { if (active && token) router.replace("/(tabs)"); }).catch(() => undefined);
    return () => { active = false; };
  }, [router]);

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setNotice("");
    setVerificationPending(false);
  };

  const finishSignedIn = async () => {
    const profile = await getStoredProfile();
    await syncProfileToSupabase(profile);
    router.replace("/(tabs)");
  };

  const submitEmail = async () => {
    if (!canSubmit || busy) return;
    if (!supabaseConfig.isConfigured) { setError(configurationMessage); return; }
    setBusyAction("email");
    setError("");
    setNotice("");
    try {
      if (mode === "signup") {
        const response = await signUpWithEmail(normalizedEmail, password, name);
        if (response.access_token) {
          await finishSignedIn();
        } else {
          setVerificationPending(true);
          setNotice(language === "bn" ? `${normalizedEmail}-এ verification link পাঠানো হয়েছে। Email খুলে link-এ click করে তারপর sign in করুন।` : `A verification link was sent to ${normalizedEmail}. Verify your email, then sign in.`);
        }
      } else {
        await signInWithEmail(normalizedEmail, password);
        await finishSignedIn();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : language === "bn" ? "Account access করা যায়নি। আবার চেষ্টা করুন।" : "We could not access your account. Please try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const resendVerification = async () => {
    if (busy || !validEmail) return;
    setBusyAction("resend");
    setError("");
    try {
      await resendSignupVerification(normalizedEmail);
      setNotice(language === "bn" ? "Verification email আবার পাঠানো হয়েছে।" : "The verification email was sent again.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : language === "bn" ? "Email পাঠানো যায়নি।" : "The email could not be sent.");
    } finally {
      setBusyAction(null);
    }
  };

  const signInWithGoogle = async () => {
    if (busy) return;
    if (!supabaseConfig.isConfigured) { setError(configurationMessage); return; }
    setBusyAction("google");
    setError("");
    try {
      const redirectTo = Linking.createURL("oauth/callback");
      const result = await WebBrowser.openAuthSessionAsync(getGoogleOAuthUrl(redirectTo), redirectTo);
      if (result.type !== "success" || !result.url) return;
      await completeGoogleOAuthRedirect(result.url);
      await finishSignedIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : language === "bn" ? "Google sign-in সম্পূর্ণ করা যায়নি।" : "Google sign-in could not be completed.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <ScreenContainer edges={["top", "right", "bottom", "left"]} safeAreaClassName="bg-ivory" className="bg-ivory">
      <View style={styles.shell}><BrandWaves /><KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.topRow}><Text style={styles.brand}>eKta Social</Text><Pressable onPress={toggleLanguage} style={styles.language}><MaterialIcons name="language" size={15} color={C.terracotta} /><Text style={[styles.languageText, { fontFamily: mediumFont }]}>{language === "bn" ? "বাং · EN" : "EN · বাং"}</Text></Pressable></View>
          <View style={styles.hero}><Image source={require("@/assets/brand/handshake-unity-final.png")} style={styles.illustration} resizeMode="contain" /><Text style={[styles.wordmark, { fontFamily: headingFont }]}>একতা</Text><Text style={[styles.tagline, { fontFamily: bodyFont }]}>{language === "bn" ? "আপনার community, একসঙ্গে" : "Your community, connected"}</Text></View>
          <View style={styles.card}>
            <Text style={[styles.title, { fontFamily: headingFont }]}>{mode === "signin" ? (language === "bn" ? "আবার স্বাগতম" : "Welcome back") : (language === "bn" ? "eKta-তে যোগ দিন" : "Join eKta")}</Text>
            <Text style={[styles.subtitle, { fontFamily: bodyFont }]}>{mode === "signin" ? (language === "bn" ? "আপনার community-তে ফিরে আসুন।" : "Continue to your local community.") : (language === "bn" ? "কয়েকটি basic details দিয়ে account তৈরি করুন।" : "Create your account with a few basic details.")}</Text>
            <View style={styles.modeSwitch}><Pressable onPress={() => changeMode("signin")} style={[styles.modeItem, mode === "signin" && styles.modeItemActive]}><Text style={[styles.modeText, { fontFamily: mediumFont }, mode === "signin" && styles.modeTextActive]}>{language === "bn" ? "Sign in" : "Sign in"}</Text></Pressable><Pressable onPress={() => changeMode("signup")} style={[styles.modeItem, mode === "signup" && styles.modeItemActive]}><Text style={[styles.modeText, { fontFamily: mediumFont }, mode === "signup" && styles.modeTextActive]}>{language === "bn" ? "Sign up" : "Sign up"}</Text></Pressable></View>
            <Pressable onPress={() => void signInWithGoogle()} disabled={busy} style={({ pressed }) => [styles.google, pressed && styles.pressed, busy && styles.disabled]}><MaterialCommunityIcons name="google" size={19} color="#4285F4" />{busyAction === "google" ? <ActivityIndicator size="small" color={C.inkNavy} /> : <Text style={[styles.googleText, { fontFamily: mediumFont }]}>{language === "bn" ? "Google দিয়ে continue করুন" : "Continue with Google"}</Text>}</Pressable>
            <View style={styles.divider}><View style={styles.line} /><Text style={[styles.or, { fontFamily: mediumFont }]}>{language === "bn" ? "অথবা email দিয়ে" : "OR WITH EMAIL"}</Text><View style={styles.line} /></View>
            {mode === "signup" ? <Field icon="person-outline" value={name} onChangeText={(value) => { setName(value); setError(""); }} placeholder={language === "bn" ? "আপনার নাম" : "Full name"} font={bodyFont} editable={!busy} /> : null}
            <Field icon="mail-outline" value={email} onChangeText={(value) => { setEmail(value); setError(""); }} placeholder={language === "bn" ? "ইমেইল ঠিকানা" : "Email address"} font={bodyFont} keyboardType="email-address" autoCapitalize="none" editable={!busy} />
            <View style={styles.inputWrap}><MaterialIcons name="lock-outline" size={19} color={C.slate} /><TextInput value={password} onChangeText={(value) => { setPassword(value); setError(""); }} placeholder={language === "bn" ? "Password (কমপক্ষে ৮ অঙ্ক)" : "Password (at least 8 characters)"} placeholderTextColor="#9A9080" secureTextEntry={!showPassword} style={[styles.input, { fontFamily: bodyFont }]} autoCapitalize="none" editable={!busy} /><Pressable onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? "Hide password" : "Show password"}><MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={19} color={C.slate} /></Pressable></View>
            {mode === "signup" ? <Text style={[styles.helper, { fontFamily: bodyFont }]}>{language === "bn" ? "Account তৈরি করার পর আপনার email-এ verification link যাবে।" : "We’ll send a verification link to your email after sign up."}</Text> : null}
            {error ? <Text style={[styles.error, { fontFamily: bodyFont }]} accessibilityRole="alert">{error}</Text> : null}
            {notice ? <Text style={[styles.notice, { fontFamily: bodyFont }]} accessibilityRole="alert">{notice}</Text> : null}
            <Pressable onPress={() => void submitEmail()} disabled={!canSubmit || busy} style={({ pressed }) => [styles.primary, (!canSubmit || busy) && styles.disabled, pressed && styles.pressed]}><Text style={[styles.primaryText, { fontFamily: mediumFont }]}>{busyAction === "email" ? (language === "bn" ? "অপেক্ষা করুন…" : "Please wait…") : mode === "signin" ? (language === "bn" ? "Email দিয়ে sign in" : "Sign in with email") : (language === "bn" ? "Account তৈরি করুন" : "Create account")}</Text><MaterialIcons name="arrow-forward" size={19} color={C.ivory} /></Pressable>
            {verificationPending ? <Pressable onPress={() => void resendVerification()} disabled={busy || !validEmail} style={styles.resend}><MaterialIcons name="mark-email-read" size={17} color={C.terracotta} /><Text style={[styles.resendText, { fontFamily: mediumFont }]}>{busyAction === "resend" ? (language === "bn" ? "পাঠানো হচ্ছে…" : "Sending…") : (language === "bn" ? "Verification email আবার পাঠান" : "Resend verification email")}</Text></Pressable> : null}
            <Pressable onPress={() => router.push("/auth/phone")} style={styles.otpLink}><Text style={[styles.otpText, { fontFamily: mediumFont }]}>{language === "bn" ? "Password ছাড়া email OTP ব্যবহার করুন" : "Use email OTP without a password"}</Text></Pressable>
            {!supabaseConfig.isConfigured ? <Text style={[styles.demo, { fontFamily: bodyFont }]}>{configurationMessage}</Text> : null}
          </View>
          <Text style={[styles.footer, { fontFamily: bodyFont }]}>Sanket Pixel Technologies</Text>
        </View>
      </ScrollView></KeyboardAvoidingView></View>
    </ScreenContainer>
  );
}

function Field({ icon, value, onChangeText, placeholder, font, keyboardType, autoCapitalize = "sentences", editable }: { icon: "person-outline" | "mail-outline"; value: string; onChangeText: (value: string) => void; placeholder: string; font: string; keyboardType?: "email-address"; autoCapitalize?: "none" | "sentences"; editable: boolean }) {
  return <View style={styles.inputWrap}><MaterialIcons name={icon} size={19} color={C.slate} /><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9A9080" style={[styles.input, { fontFamily: font }]} keyboardType={keyboardType} autoCapitalize={autoCapitalize} autoCorrect={false} editable={editable} /></View>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#FBF7F0", overflow: "hidden" }, keyboard: { flex: 1 }, scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 7, paddingBottom: 20 }, page: { width: "100%", maxWidth: 440, alignSelf: "center", flexGrow: 1 }, topRow: { minHeight: 38, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, brand: { color: C.inkNavy, fontFamily: "Fraunces", fontSize: 17 }, language: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFF", borderWidth: 1, borderColor: C.line, borderRadius: 999, minHeight: 35, paddingHorizontal: 11 }, languageText: { color: C.terracotta, fontSize: 11 }, hero: { alignItems: "center", paddingTop: 6, paddingBottom: 14 }, illustration: { width: 190, height: 125 }, wordmark: { color: C.inkNavy, fontSize: 35, lineHeight: 45 }, tagline: { color: C.slate, fontSize: 13, marginTop: 3 }, card: { backgroundColor: "rgba(255,255,255,0.95)", borderWidth: 1, borderColor: "#E9DFD0", borderRadius: 24, padding: 17, shadowColor: "#352D21", shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, title: { color: C.inkNavy, fontSize: 25, textAlign: "center" }, subtitle: { color: C.slate, fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 15 }, modeSwitch: { flexDirection: "row", backgroundColor: C.primaryContainer, borderRadius: 14, padding: 4, marginBottom: 14 }, modeItem: { flex: 1, minHeight: 39, alignItems: "center", justifyContent: "center", borderRadius: 11 }, modeItemActive: { backgroundColor: C.paper, shadowColor: C.inkNavy, shadowOpacity: 0.08, shadowRadius: 5, elevation: 1 }, modeText: { color: C.slate, fontSize: 12 }, modeTextActive: { color: C.terracotta, fontWeight: "800" }, google: { minHeight: 50, borderWidth: 1, borderColor: C.line, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, googleText: { color: C.inkNavy, fontSize: 13 }, divider: { flexDirection: "row", alignItems: "center", gap: 9, marginVertical: 15 }, line: { flex: 1, height: 1, backgroundColor: C.line }, or: { color: C.slate, fontSize: 9, letterSpacing: 0.5 }, inputWrap: { minHeight: 51, borderWidth: 1, borderColor: C.line, borderRadius: 15, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10, backgroundColor: C.paper }, input: { flex: 1, color: C.inkNavy, fontSize: 14, minHeight: 48 }, helper: { color: C.slate, fontSize: 11, lineHeight: 17, marginTop: 1, marginBottom: 5 }, primary: { minHeight: 51, borderRadius: 15, backgroundColor: C.terracotta, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 7 }, primaryText: { color: C.ivory, fontSize: 13 }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.82 }, error: { color: C.error, fontSize: 12, lineHeight: 18, marginTop: 7 }, notice: { color: C.leafGreen, backgroundColor: C.primaryContainer, borderRadius: 12, padding: 10, fontSize: 12, lineHeight: 18, marginTop: 7 }, resend: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, resendText: { color: C.terracotta, fontSize: 12 }, otpLink: { alignItems: "center", paddingVertical: 13 }, otpText: { color: C.leafGreen, fontSize: 11, textAlign: "center" }, demo: { color: C.slate, fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 5 }, footer: { color: "#A49682", fontSize: 10, textAlign: "center", marginTop: 14 },
});

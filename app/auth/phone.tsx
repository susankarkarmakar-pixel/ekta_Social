import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandWaves } from "@/components/brand/BrandWaves";
import { ScreenContainer } from "@/components/screen-container";
import { Colors } from "@/constants/theme";
import {
  completeSupabaseRedirect,
  completeGoogleOAuthRedirect,
  getGoogleOAuthUrl,
  getSupabaseAccessToken,
  sendEmailOtp,
  SupabaseAuthError,
  verifyEmailOtp,
} from "@/lib/apongram/supabase-auth";
import { supabaseConfig } from "@/lib/apongram/supabase-config";
import { getStoredProfile, syncProfileToSupabase } from "@/lib/apongram/profile-store";
import { useLanguage } from "@/lib/apongram/LanguageContext";
import { isValidEmailAddress } from "@/lib/apongram/email-validation";

type PolicyKind = "guidelines" | "privacy" | null;
type BusyAction = "google" | "send" | "verify" | "resend" | null;

const LIGHT = Colors.light;

function getEmailAuthRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return new URL("/auth/phone", window.location.origin).toString();
  }
  return Linking.createURL("auth/phone");
}

export default function PhoneAuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { copy, language, toggleLanguage } = useLanguage();
  const bodyFont = language === "bn" ? "HindSiliguri" : "HindSiliguriLatin";
  const mediumFont = language === "bn" ? "HindSiliguriSemiBold" : "HindSiliguriLatinSemiBold";
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [openPolicy, setOpenPolicy] = useState<PolicyKind>(null);
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const handledAuthRedirect = useRef<string | null>(null);
  const busy = busyAction !== null;
  const normalizedEmail = email.trim();
  const canSend = isValidEmailAddress(normalizedEmail);
  const canVerify = otp.replace(/\D/g, "").length === 6;
  const emailInvalid = emailTouched && normalizedEmail.length > 0 && !canSend;
  const otpDigits = otp.replace(/\D/g, "").slice(0, 6);
  const configurationMessage = language === "bn"
    ? "বাস্তব sign-in চালাতে EXPO_PUBLIC_SUPABASE_URL ও EXPO_PUBLIC_SUPABASE_ANON_KEY configure করুন।"
    : "Live sign-in needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.";

  useEffect(() => {
    let active = true;
    void getSupabaseAccessToken()
      .then((token) => {
        if (active && token) router.replace("/(tabs)");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const handleAuthRedirect = async (url: string | null) => {
      if (!url || !/(?:access_token|refresh_token|error|error_description|error_code)=/.test(url)) return;
      if (handledAuthRedirect.current === url) return;
      handledAuthRedirect.current = url;
      setBusyAction("verify");
      setError("");
      try {
        await completeSupabaseRedirect(url);
        const profile = await getStoredProfile();
        await syncProfileToSupabase(profile);
        router.replace("/(tabs)");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : (language === "bn" ? "ইমেইল লিংক দিয়ে সাইন ইন সম্পূর্ণ করা যায়নি।" : "Email-link sign-in could not be completed."));
      } finally {
        setBusyAction(null);
      }
    };

    let subscription: ReturnType<typeof Linking.addEventListener> | undefined;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      void handleAuthRedirect(window.location.href);
    } else {
      void Linking.getInitialURL().then(handleAuthRedirect).catch(() => undefined);
      subscription = Linking.addEventListener("url", ({ url }) => void handleAuthRedirect(url));
    }
    return () => subscription?.remove();
  }, [language, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const sendOtp = async () => {
    setEmailTouched(true);
    if (busy || !canSend) return;
    setBusyAction("send");
    setError("");
    try {
      if (!supabaseConfig.isConfigured) throw new SupabaseAuthError(configurationMessage);
      await sendEmailOtp(normalizedEmail, getEmailAuthRedirectUrl());
      setSent(true);
      setOtp("");
      setResendIn(30);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (language === "bn" ? "OTP পাঠানো যায়নি। আবার চেষ্টা করুন।" : "We could not send the OTP. Please try again."));
    } finally {
      setBusyAction(null);
    }
  };

  const resendOtp = async () => {
    if (busy || resendIn > 0) return;
    setBusyAction("resend");
    setError("");
    try {
      if (!supabaseConfig.isConfigured) throw new SupabaseAuthError(configurationMessage);
      await sendEmailOtp(normalizedEmail, getEmailAuthRedirectUrl());
      setOtp("");
      setResendIn(30);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (language === "bn" ? "OTP আবার পাঠানো যায়নি।" : "We could not resend the OTP."));
    } finally {
      setBusyAction(null);
    }
  };

  const signInWithGoogle = async () => {
    if (busy) return;
    if (!supabaseConfig.isConfigured) {
      setError(configurationMessage);
      return;
    }
    setBusyAction("google");
    setError("");
    try {
      const redirectTo = Linking.createURL("oauth/callback");
      const result = await WebBrowser.openAuthSessionAsync(getGoogleOAuthUrl(redirectTo), redirectTo);
      if (result.type !== "success" || !result.url) return;
      await completeGoogleOAuthRedirect(result.url);
      const profile = await getStoredProfile();
      await syncProfileToSupabase(profile);
      router.replace("/(tabs)");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (language === "bn" ? "Google sign-in সম্পূর্ণ করা যায়নি।" : "Google sign-in could not be completed."));
    } finally {
      setBusyAction(null);
    }
  };

  const verifyOtp = async () => {
    if (busy || !canVerify) return;
    setBusyAction("verify");
    setError("");
    try {
      if (!supabaseConfig.isConfigured) throw new SupabaseAuthError(configurationMessage);
      await verifyEmailOtp(otpDigits, normalizedEmail);
      const profile = await getStoredProfile();
      await syncProfileToSupabase(profile);
      setVerified(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (language === "bn" ? "OTP যাচাই করা যায়নি।" : "We could not verify the OTP."));
    } finally {
      setBusyAction(null);
    }
  };

  const setOtpDigit = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length > 1) {
      const pasted = digits.slice(0, 6);
      setOtp(pasted);
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
      return;
    }
    const next = otpDigits.split("");
    next[index] = digits;
    setOtp(next.join("").slice(0, 6));
    if (digits && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key !== "Backspace" || otpDigits[index]) return;
    if (index > 0) {
      const next = otpDigits.split("");
      next[index - 1] = "";
      setOtp(next.join(""));
      otpRefs.current[index - 1]?.focus();
    }
  };

  const policyContent = openPolicy === "guidelines"
    ? {
        title: language === "bn" ? "কমিউনিটি নির্দেশিকা" : "Community Guidelines",
        intro: language === "bn" ? "eKta-তে স্থানীয় কথোপকথন নিরাপদ, সম্মানজনক ও কাজে লাগে—এটাই আমাদের লক্ষ্য।" : "Keep local conversations useful, respectful and safe for everyone in the eKta community.",
        points: language === "bn"
          ? ["মানুষ ও মতের প্রতি সম্মান দেখান; হয়রানি, হুমকি বা ঘৃণামূলক ভাষা এড়িয়ে চলুন।", "ভুল তথ্য, স্প্যাম বা অন্যের পরিচয়/ব্যক্তিগত তথ্য অনুমতি ছাড়া ছড়াবেন না।", "ক্ষতিকর পোস্ট দেখলে পোস্টের মেনু থেকে রিপোর্ট করুন।"]
          : ["Treat people and differing opinions with respect; do not harass, threaten or use hateful language.", "Do not spread spam, knowingly false information or someone else’s private details without permission.", "Use the post menu to report content that may harm the community."],
      }
    : openPolicy === "privacy"
      ? {
          title: language === "bn" ? "প্রতিবেশীর গোপনীয়তার সনদ" : "Neighborhood Privacy Charter",
          intro: language === "bn" ? "পাইলট অভিজ্ঞতায় প্রয়োজনের চেয়ে বেশি ব্যক্তিগত তথ্য শেয়ার না করাই সবচেয়ে নিরাপদ।" : "For this pilot, share only what is needed and avoid posting sensitive personal information.",
          points: language === "bn"
            ? ["ইমেইল শুধু একবার ব্যবহারযোগ্য sign-in code-এর জন্য ব্যবহৃত হয়।", "আধার বা অন্য সরকারি পরিচয় নম্বর, password কিংবা OTP পোস্ট/শেয়ার করবেন না।", "এই পাইলটে বিজ্ঞাপনভিত্তিক লক্ষ্যকরণ বা recommendation profiling নেই।"]
            : ["Your email is used to authenticate you with a one-time sign-in code.", "Never post or share Aadhaar or other government ID numbers, passwords or OTPs.", "This pilot has no ad targeting or recommendation profiling."],
        }
      : null;

  const policyNotice = language === "bn"
    ? "এটি পাইলটের সংক্ষিপ্ত নীতিসার; পূর্ণাঙ্গ Community Guidelines ও Privacy Policy এখনও প্রকাশিত হয়নি।"
    : "Pilot summary only. Full Community Guidelines and Privacy Policy have not been published yet.";

  return (
    <ScreenContainer edges={["top", "right", "bottom", "left"]} safeAreaClassName="bg-ivory" className="bg-ivory">
      <View style={styles.shell}>
        <BrandWaves />
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.page}>
              <View style={styles.topRow}>
                <Text style={styles.topBrand}>eKta Social</Text>
                <Pressable onPress={() => { setError(""); toggleLanguage(); }} style={styles.language} accessibilityRole="button" accessibilityLabel={language === "bn" ? "Switch language to English" : "বাংলা ভাষায় পরিবর্তন করুন"}>
                  <MaterialIcons name="language" size={15} color={LIGHT.terracotta} />
                  <Text style={[styles.languageText, { fontFamily: mediumFont }]}>{language === "bn" ? "বাং · EN" : "EN · বাং"}</Text>
                </Pressable>
              </View>

              <View style={styles.hero} accessibilityLabel="eKta Social, একতা, Your Community, Connected">
                <Image
                  source={require("@/assets/brand/handshake-unity-final.png")}
                  style={styles.illustration}
                  resizeMode="contain"
                  accessibilityLabel={language === "bn" ? "একতার প্রতীক হিসেবে দুটি হাতের বন্ধন" : "Two hands clasped in unity"}
                  accessibilityIgnoresInvertColors
                />
                <Text style={styles.wordmark}>একতা</Text>
                <View style={styles.tricolorUnderline} accessibilityElementsHidden>
                  <View style={[styles.underlineSegment, { backgroundColor: "#E96B35" }]} />
                  <View style={[styles.underlineSegment, { backgroundColor: "#F1B941" }]} />
                  <View style={[styles.underlineSegment, { backgroundColor: "#27864F" }]} />
                </View>
                <Text style={styles.tagline}>Your Community, Connected</Text>
              </View>

              {verified ? (
                <View style={styles.successCard} accessibilityRole="alert">
                  <View style={styles.successIcon}><MaterialIcons name="check" size={28} color="#FFFFFF" /></View>
                  <Text style={[styles.successTitle, { fontFamily: mediumFont }]}>{copy.verifiedMessage}</Text>
                  <Text style={[styles.successBody, { fontFamily: bodyFont }]}>{language === "bn" ? "আপনার ইমেইল যাচাই হয়েছে। eKta কমিউনিটিতে চলুন।" : "Your email is verified. You’re ready to join the eKta community."}</Text>
                  <Pressable onPress={() => router.replace("/(tabs)")} style={styles.primaryButton} accessibilityRole="button">
                    <Text style={[styles.primaryButtonText, { fontFamily: mediumFont }]}>{language === "bn" ? "eKta-তে এগিয়ে যান" : "Continue to eKta"}</Text>
                    <MaterialIcons name="arrow-forward" size={19} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.formCard}>
                  <Pressable
                    onPress={() => void signInWithGoogle()}
                    disabled={busy}
                    style={({ pressed }) => [styles.googleButton, pressed && !busy && styles.pressed, busy && styles.disabled]}
                    accessibilityRole="button"
                    accessibilityLabel={language === "bn" ? "Google দিয়ে চালিয়ে যান" : "Continue with Google"}
                  >
                    {busyAction === "google" ? <ActivityIndicator size="small" color={LIGHT.inkNavy} /> : <MaterialCommunityIcons name="google" size={19} color="#4285F4" />}
                    <Text style={[styles.googleButtonLabel, { fontFamily: mediumFont }]}>{language === "bn" ? "Google দিয়ে চালিয়ে যান" : "Continue with Google"}</Text>
                  </Pressable>

                  <View style={styles.divider} accessible accessibilityLabel={language === "bn" ? "অথবা" : "OR"}>
                    <View style={styles.dividerLine} />
                    <Text style={[styles.dividerText, { fontFamily: mediumFont }]}>{language === "bn" ? "অথবা" : "OR"}</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <Text style={[styles.label, { fontFamily: mediumFont }]}>{sent ? copy.otpLabel : (language === "bn" ? "ইমেইল ঠিকানা" : "Email address")}</Text>
                  {sent ? (
                    <>
                      <Text style={[styles.sentNote, { fontFamily: bodyFont }]}>
                        {language === "bn" ? `${normalizedEmail}-এ ৬ সংখ্যার কোড পাঠানো হয়েছে।` : `We sent a 6-digit code to ${normalizedEmail}.`}
                      </Text>
                      <View style={styles.otpRow}>
                        {Array.from({ length: 6 }, (_, index) => (
                          <TextInput
                            key={index}
                            ref={(ref) => { otpRefs.current[index] = ref; }}
                            value={otpDigits[index] ?? ""}
                            onChangeText={(value) => setOtpDigit(index, value)}
                            onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            maxLength={6}
                            autoFocus={index === 0}
                            editable={!busy}
                            selectTextOnFocus
                            accessibilityLabel={`${copy.otpDigit} ${index + 1}`}
                            style={[styles.otpBox, { fontFamily: mediumFont }, otpDigits[index] ? styles.otpBoxFilled : null, index === otpDigits.length ? styles.otpBoxActive : null]}
                          />
                        ))}
                      </View>
                    </>
                  ) : (
                    <View style={[styles.inputWrap, emailInvalid && styles.inputInvalid]}>
                      <MaterialIcons name="mail-outline" size={19} color={emailInvalid ? LIGHT.error : LIGHT.slate} />
                      <TextInput
                        value={email}
                        onChangeText={(value) => { setEmail(value); setError(""); }}
                        onBlur={() => setEmailTouched(true)}
                        keyboardType="email-address"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType="done"
                        placeholder="you@example.com"
                        placeholderTextColor="#9A9080"
                        style={[styles.input, { fontFamily: bodyFont }]}
                        maxLength={120}
                        editable={!busy}
                        accessibilityLabel={language === "bn" ? "ইমেইল ঠিকানা" : "Email address"}
                        accessibilityHint={language === "bn" ? "OTP পাঠানোর জন্য আপনার ইমেইল লিখুন" : "Enter your email address to receive a one-time code"}
                      />
                      {canSend ? <MaterialIcons name="check-circle" size={18} color={LIGHT.leafGreen} /> : null}
                    </View>
                  )}
                  {!sent && emailInvalid ? <Text style={[styles.fieldError, { fontFamily: bodyFont }]} accessibilityRole="alert">{language === "bn" ? "সঠিক ইমেইল ঠিকানা লিখুন।" : "Enter a valid email address."}</Text> : null}

                  <Pressable
                    onPress={() => void (sent ? verifyOtp() : sendOtp())}
                    disabled={busy || (sent ? !canVerify : !canSend)}
                    style={({ pressed }) => [styles.primaryButton, pressed && !busy && styles.pressed, (busy || (sent ? !canVerify : !canSend)) && styles.disabled]}
                    accessibilityRole="button"
                    accessibilityLabel={sent ? (language === "bn" ? "OTP যাচাই করুন" : "Verify OTP") : copy.sendOtp}
                  >
                    {busyAction === "send" || busyAction === "verify" ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                    <Text style={[styles.primaryButtonText, { fontFamily: mediumFont }]}>
                      {busyAction === "send"
                        ? (language === "bn" ? "কোড পাঠানো হচ্ছে…" : "Sending code…")
                        : busyAction === "verify"
                          ? (language === "bn" ? "যাচাই হচ্ছে…" : "Verifying…")
                          : sent ? copy.verify : copy.sendOtp}
                    </Text>
                    {busyAction !== "send" && busyAction !== "verify" ? <MaterialIcons name="arrow-forward" size={19} color="#FFFFFF" /> : null}
                  </Pressable>

                  {sent ? (
                    <View style={styles.resendRow}>
                      <Pressable onPress={() => void resendOtp()} disabled={busy || resendIn > 0} accessibilityRole="button">
                        {busyAction === "resend" ? <ActivityIndicator size="small" color={LIGHT.terracotta} /> : <Text style={[styles.textLink, { fontFamily: mediumFont }, (busy || resendIn > 0) && styles.textLinkDisabled]}>{resendIn > 0 ? `${copy.resend} (${resendIn}s)` : copy.resend}</Text>}
                      </Pressable>
                      <Pressable onPress={() => { setSent(false); setOtp(""); setError(""); setEmailTouched(false); }} disabled={busy} accessibilityRole="button">
                        <Text style={[styles.textLink, { fontFamily: mediumFont }, busy && styles.textLinkDisabled]}>{language === "bn" ? "ইমেইল বদলান" : "Change email"}</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {error ? <Text style={[styles.error, { fontFamily: bodyFont }]} accessibilityRole="alert">{error}</Text> : null}
                  {!supabaseConfig.isConfigured && !error ? <Text style={[styles.demoNote, { fontFamily: bodyFont }]}>{copy.demoModeText}</Text> : null}

                  <Text style={[styles.disclaimer, { fontFamily: bodyFont }]}>
                    {language === "bn" ? "সাইন ইন করে আপনি আমাদের " : "By signing in, you agree to our "}
                    <Text style={styles.inlineLink} accessibilityRole="link" onPress={() => setOpenPolicy("guidelines")}>{language === "bn" ? "কমিউনিটি নির্দেশিকা" : "Community Guidelines"}</Text>
                    {language === "bn" ? " অনুসরণ এবং " : " and "}
                    <Text style={styles.inlineLink} accessibilityRole="link" onPress={() => setOpenPolicy("privacy")}>{language === "bn" ? "গোপনীয়তার সনদ" : "Privacy Charter"}</Text>
                    {language === "bn" ? " পড়তে সম্মত হচ্ছেন।" : "."}
                  </Text>
                  <View style={styles.policyLinks}>
                    <Pressable onPress={() => setOpenPolicy("guidelines")} accessibilityRole="link"><Text style={[styles.textLink, { fontFamily: mediumFont }]}>{language === "bn" ? "নির্দেশিকা দেখুন" : "Read guidelines"}</Text></Pressable>
                    <View style={styles.policySeparator} />
                    <Pressable onPress={() => setOpenPolicy("privacy")} accessibilityRole="link"><Text style={[styles.textLink, { fontFamily: mediumFont }]}>{language === "bn" ? "গোপনীয়তা দেখুন" : "Read privacy charter"}</Text></Pressable>
                  </View>
                  <Text style={[styles.policyCaveat, { fontFamily: bodyFont }]}>{language === "bn" ? "পাইলট নীতিসার · পূর্ণ নীতিমালা প্রস্তুত হচ্ছে" : "Pilot policy summary · full policy is being prepared"}</Text>
                </View>
              )}

              <Text style={styles.footer}>Sanket Pixel Technologies</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <Modal visible={openPolicy !== null} transparent animationType="slide" onRequestClose={() => setOpenPolicy(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenPolicy(null)} accessibilityRole="button" accessibilityLabel={copy.back} />
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) }]} accessibilityViewIsModal>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily: mediumFont }]}>{policyContent?.title}</Text>
              <Pressable onPress={() => setOpenPolicy(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={copy.back}>
                <MaterialIcons name="close" size={22} color={LIGHT.slate} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalIntro, { fontFamily: bodyFont }]}>{policyContent?.intro}</Text>
              {policyContent?.points.map((point, index) => (
                <View key={point} style={styles.policyPoint}>
                  <View style={styles.policyNumber}><Text style={styles.policyNumberText}>{index + 1}</Text></View>
                  <Text style={[styles.policyPointText, { fontFamily: bodyFont }]}>{point}</Text>
                </View>
              ))}
              <Text style={[styles.modalNotice, { fontFamily: bodyFont }]}>{policyNotice}</Text>
            </ScrollView>
            <Pressable onPress={() => setOpenPolicy(null)} style={styles.modalDone} accessibilityRole="button">
              <Text style={[styles.modalDoneText, { fontFamily: mediumFont }]}>{language === "bn" ? "বুঝেছি" : "Got it"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#FBF7F0", overflow: "hidden" },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 7, paddingBottom: 16 },
  page: { width: "100%", maxWidth: 440, alignSelf: "center", flexGrow: 1, justifyContent: "center" },
  topRow: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topBrand: { color: LIGHT.inkNavy, fontFamily: "Fraunces", fontSize: 17, letterSpacing: -0.2 },
  language: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.82)", borderWidth: 1, borderColor: LIGHT.line, borderRadius: 999, minHeight: 35, paddingHorizontal: 11 },
  languageText: { color: LIGHT.terracotta, fontSize: 11, fontWeight: "700" },
  hero: { alignItems: "center", paddingTop: 3, paddingBottom: 15 },
  illustration: { width: 218, height: 153, marginBottom: -4 },
  wordmark: { color: LIGHT.inkNavy, fontFamily: "NotoSerifBengaliBold", fontSize: 36, lineHeight: 49, textAlign: "center" },
  tricolorUnderline: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 0 },
  underlineSegment: { width: 23, height: 3, borderRadius: 2 },
  tagline: { color: LIGHT.slate, fontFamily: "HindSiliguriLatin", textAlign: "center", fontSize: 13, marginTop: 6, letterSpacing: 0.1 },
  formCard: { width: "100%", backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: "#E9DFD0", borderRadius: 24, padding: 17, shadowColor: "#352D21", shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  googleButton: { minHeight: 51, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 15, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: LIGHT.line, paddingHorizontal: 12 },
  googleButtonLabel: { color: LIGHT.inkNavy, fontSize: 13, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 11, marginVertical: 16 },
  dividerLine: { height: 1, backgroundColor: "#E8E0D4", flex: 1 },
  dividerText: { color: LIGHT.slate, fontSize: 11, letterSpacing: 0.6 },
  label: { color: LIGHT.inkNavy, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  sentNote: { color: LIGHT.slate, fontSize: 12, lineHeight: 18, marginTop: -1, marginBottom: 11 },
  inputWrap: { minHeight: 53, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1.2, borderColor: LIGHT.line, borderRadius: 14, paddingHorizontal: 13 },
  inputInvalid: { borderColor: LIGHT.error },
  input: { flex: 1, minWidth: 0, color: LIGHT.inkNavy, fontSize: 14, paddingVertical: 10 },
  fieldError: { color: LIGHT.error, fontSize: 11, marginTop: 6, marginBottom: -4 },
  otpRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  otpBox: { flex: 1, minWidth: 0, maxWidth: 52, height: 51, padding: 0, borderWidth: 1.4, borderColor: LIGHT.line, borderRadius: 12, backgroundColor: "#FFFFFF", color: LIGHT.inkNavy, fontSize: 21, fontWeight: "600", textAlign: "center" },
  otpBoxFilled: { borderColor: LIGHT.inkNavy },
  otpBoxActive: { borderWidth: 2, borderColor: LIGHT.terracotta },
  primaryButton: { minHeight: 53, backgroundColor: LIGHT.terracotta, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, paddingHorizontal: 14, marginTop: 13, shadowColor: LIGHT.terracotta, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  resendRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 23, minHeight: 39, marginTop: 4 },
  textLink: { color: LIGHT.terracotta, textAlign: "center", fontSize: 11, fontWeight: "700" },
  textLinkDisabled: { opacity: 0.45 },
  error: { color: LIGHT.error, backgroundColor: "#FFF1EC", borderRadius: 11, padding: 10, lineHeight: 17, fontSize: 11, marginTop: 10 },
  demoNote: { color: LIGHT.slate, backgroundColor: LIGHT.primaryContainer, borderRadius: 11, padding: 10, textAlign: "center", lineHeight: 17, fontSize: 10, marginTop: 12 },
  disclaimer: { color: LIGHT.slate, textAlign: "center", lineHeight: 18, fontSize: 10.5, marginTop: 15, paddingHorizontal: 2 },
  inlineLink: { color: LIGHT.terracotta, fontWeight: "700", textDecorationLine: "underline" },
  policyLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 11 },
  policySeparator: { width: 3, height: 3, borderRadius: 2, backgroundColor: LIGHT.line },
  policyCaveat: { color: LIGHT.slate, textAlign: "center", fontSize: 9, marginTop: 9, opacity: 0.8 },
  successCard: { width: "100%", alignItems: "center", backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: "#E9DFD0", borderRadius: 24, padding: 24, shadowColor: "#352D21", shadowOpacity: 0.08, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 2, marginTop: 2 },
  successIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: LIGHT.leafGreen },
  successTitle: { color: LIGHT.inkNavy, fontSize: 17, textAlign: "center", marginTop: 14 },
  successBody: { color: LIGHT.slate, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 6 },
  footer: { color: LIGHT.slate, fontFamily: "HindSiliguriLatin", fontSize: 9, textAlign: "center", letterSpacing: 0.25, marginTop: 14, marginBottom: 2 },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(22,23,21,0.38)" },
  modalCard: { width: "100%", maxWidth: 500, maxHeight: "82%", alignSelf: "center", backgroundColor: "#FBF7F0", borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 21, paddingTop: 12 },
  modalHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#D8CEBF", marginBottom: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 13 },
  modalTitle: { flex: 1, color: LIGHT.inkNavy, fontSize: 18, fontWeight: "700" },
  modalScroll: { flexGrow: 0 },
  modalIntro: { color: LIGHT.inkNavy, fontSize: 14, lineHeight: 21, marginBottom: 13 },
  policyPoint: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  policyNumber: { width: 23, height: 23, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F9E5D0", marginTop: 1 },
  policyNumberText: { color: LIGHT.terracotta, fontSize: 11, fontWeight: "800" },
  policyPointText: { flex: 1, color: LIGHT.slate, fontSize: 13, lineHeight: 20 },
  modalNotice: { color: LIGHT.slate, backgroundColor: "#F1EBDD", borderRadius: 12, padding: 12, fontSize: 11, lineHeight: 17, marginTop: 3 },
  modalDone: { minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: LIGHT.terracotta, borderRadius: 14, marginTop: 15 },
  modalDoneText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});

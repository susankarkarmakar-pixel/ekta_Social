import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { Avatar } from "@/components/apongram/Avatar";
import { FeedSkeleton } from "@/components/apongram/FeedSkeleton";
import { PostCard } from "@/components/apongram/PostCard";
import { StoryRail } from "@/components/apongram/StoryRail";
import { TopicChip } from "@/components/apongram/TopicChip";
import { Logo } from "@/components/Logo";
import { ScreenContainer } from "@/components/screen-container";
import { Colors } from "@/constants/theme";
import { currentUser, topicLabels, topics } from "@/lib/apongram/mock-data";
import { useFeedPreferences } from "@/lib/apongram/FeedPreferencesContext";
import { useLanguage } from "@/lib/apongram/LanguageContext";
import { useFeedController } from "@/lib/apongram/useFeedController";
import { useStoryController } from "@/lib/apongram/useStoryController";
import { getGreetingCopyKey } from "@/lib/apongram/greeting";
import type { Post } from "@/lib/apongram/types";

const C = {
  ...Colors.light,
  card: Colors.light.paper,
  ink: Colors.light.inkNavy,
  muted: Colors.light.slate,
  terra: Colors.light.terracotta,
  line: Colors.light.line,
  green: Colors.light.leafGreen,
};

export default function HomeScreen() {
  const router = useRouter();
  const { language, copy } = useLanguage();
  const bodyFont = language === "bn" ? "HindSiliguri" : "HindSiliguriLatin";
  const mediumFont =
    language === "bn" ? "HindSiliguriSemiBold" : "HindSiliguriLatinSemiBold";
  const headingFont = language === "bn" ? "NotoSerifBengaliBold" : "Fraunces";
  const greeting = copy[getGreetingCopyKey(new Date())];
  const { preferences } = useFeedPreferences();
  const story = useStoryController({
    onCreateStory: () =>
      router.push({ pathname: "/(tabs)/create", params: { mode: "story" } }),
  });
  const feedState = useFeedController({ preferences });
  const {
    feed,
    feedMode,
    setFeedMode,
    loadingMore,
    refreshing,
    feedError,
    feedOffline,
    refreshNotice,
    hiddenPostIds,
    setHiddenPostIds,
    hasMore,
    activeVideoId,
    webPullDistance,
    reloadFeed,
    loadMore,
    handleScroll,
    handleWebTouchStart,
    handleWebTouchMove,
    handleWebTouchEnd,
    handleCardLayout,
    toggleLike,
  } = feedState;

  useFocusEffect(
    useCallback(() => {
      void reloadFeed();
    }, [reloadFeed]),
  );

  const visibleFeed = useMemo(
    () => feed.filter((post) => !hiddenPostIds.includes(post.id)),
    [feed, hiddenPostIds],
  );

  const renderPost = useCallback<ListRenderItem<Post>>(
    ({ item }) => (
      <PostCard
        post={item}
        copy={copy}
        isVideoActive={activeVideoId === item.id}
        onLayout={(event) => handleCardLayout(item.id, event)}
        onOpen={() =>
          router.push({ pathname: "/post/[id]", params: { id: item.id } })
        }
        onAuthor={() =>
          router.push({
            pathname: "/(tabs)/profile",
            params: { id: item.author.id },
          })
        }
        onHide={() => setHiddenPostIds((ids) => [...ids, item.id])}
        onLike={() => toggleLike(item.id)}
        onReport={() =>
          router.push({ pathname: "/report", params: { postId: item.id } })
        }
      />
    ),
    [
      activeVideoId,
      copy,
      handleCardLayout,
      router,
      setHiddenPostIds,
      toggleLike,
    ],
  );

  const header = (
    <View>
      {Platform.OS === "web" && webPullDistance > 0 ? (
        <View style={styles.pullIndicator}>
          <MaterialIcons
            name={webPullDistance >= 64 ? "refresh" : "arrow-downward"}
            size={18}
            color={C.terra}
          />
          <Text style={[styles.pullText, { fontFamily: bodyFont }]}>
            {webPullDistance >= 64 ? copy.releaseToRefresh : copy.pullToRefresh}
          </Text>
        </View>
      ) : null}

      <View style={styles.topbar}>
        <Logo variant="horizontal" width={126} height={30} />
        <View style={styles.topActions}>
          <Pressable
            onPress={() => router.push("/(tabs)/discover")}
            style={styles.iconAction}
            accessibilityRole="button"
            accessibilityLabel={copy.discover}
            hitSlop={8}
          >
            <MaterialIcons name="search" size={22} color={C.ink} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/messages" as never)}
            style={styles.iconAction}
            accessibilityRole="button"
            accessibilityLabel={copy.messages}
            hitSlop={8}
          >
            <MaterialIcons name="chat-bubble-outline" size={21} color={C.ink} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/alerts")}
            style={styles.iconAction}
            accessibilityRole="button"
            accessibilityLabel={copy.alerts}
            hitSlop={8}
          >
            <MaterialIcons name="notifications-none" size={22} color={C.ink} />
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>2</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            style={styles.avatarAction}
            accessibilityRole="button"
            accessibilityLabel={copy.profile}
            hitSlop={6}
          >
            <Avatar profile={currentUser} size={32} />
          </Pressable>
        </View>
      </View>

      <StoryRail
        people={story.people}
        viewedIds={story.viewedIds}
        viewer={story.viewer}
        post={story.post}
        index={story.index}
        storyIndex={story.storyIndex}
        storyCount={story.storyCount}
        open={story.open}
        paused={story.paused}
        reply={story.reply}
        replySent={story.replySent}
        reaction={story.reaction}
        reactionPickerOpen={story.reactionPickerOpen}
        language={language}
        bodyFont={bodyFont}
        mediumFont={mediumFont}
        headingFont={headingFont}
        reelsLabel={copy.reels}
        onOpen={story.onOpen}
        onClose={story.close}
        onPause={story.setPaused}
        onMove={story.move}
        onReplyChange={story.setReply}
        onSendReply={story.sendReply}
        onReaction={story.toggleReaction}
        onReactionPickerChange={story.setReactionPickerOpen}
        onShare={story.share}
        onReport={() => {
          story.close();
          router.push({
            pathname: "/report",
            params: { storyId: story.viewer?.id ?? "" },
          });
        }}
        onWatchReels={() => router.push("/(tabs)/reels")}
      />

      <View style={heroStyles.card}>
        <View style={heroStyles.copy}>
          <View style={heroStyles.eyebrow}>
            <View style={heroStyles.dot} />
            <Text style={[heroStyles.eyebrowText, { fontFamily: mediumFont }]}>
              {copy.localCommunity}
            </Text>
          </View>
          <Text
            style={[
              styles.heroTitle,
              heroStyles.title,
              { fontFamily: headingFont },
            ]}
          >
            {greeting}
          </Text>
          <Text
            style={[
              styles.heroSub,
              heroStyles.subtitle,
              { fontFamily: bodyFont },
            ]}
          >
            {copy.feedIntro}
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/create")}
            style={heroStyles.action}
            accessibilityRole="button"
            accessibilityLabel={copy.shareLocalUpdate}
          >
            <MaterialIcons name="edit" size={15} color={C.card} />
            <Text style={[heroStyles.actionText, { fontFamily: mediumFont }]}>
              {copy.shareUpdate}
            </Text>
            <MaterialIcons name="arrow-forward" size={15} color={C.card} />
          </Pressable>
        </View>
        <View pointerEvents="none" style={heroStyles.illustration}>
          <View style={heroStyles.sun} />
          <View style={heroStyles.bubble}>
            <MaterialIcons name="forum" size={25} color={C.terra} />
          </View>
          <View style={heroStyles.people}>
            <MaterialIcons name="groups" size={21} color={C.green} />
          </View>
        </View>
      </View>

      <View style={styles.feedHeader}>
        <Text style={[styles.sectionTitle, { fontFamily: headingFont }]}>
          {copy.communityUpdates}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.feedFilters}
        contentContainerStyle={styles.feedFilterContent}
      >
        <Pressable
          onPress={() => setFeedMode("relevant")}
          style={[
            styles.feedMode,
            feedMode === "relevant" && styles.feedModeActive,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: feedMode === "relevant" }}
          accessibilityLabel={copy.forYou}
        >
          <Text
            style={[
              styles.feedModeText,
              { fontFamily: mediumFont },
              feedMode === "relevant" && styles.feedModeTextActive,
            ]}
          >
            {copy.forYou}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFeedMode("latest")}
          style={[
            styles.feedMode,
            feedMode === "latest" && styles.feedModeActive,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: feedMode === "latest" }}
          accessibilityLabel={copy.latest}
        >
          <Text
            style={[
              styles.feedModeText,
              { fontFamily: mediumFont },
              feedMode === "latest" && styles.feedModeTextActive,
            ]}
          >
            {copy.latest}
          </Text>
        </Pressable>
        {topics.map((topic) => (
          <TopicChip
            key={topic}
            label={(topicLabels[topic]?.[language] ?? topic).replace(/^#/, "")}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/discover",
                params: { q: topic },
              })
            }
          />
        ))}
      </ScrollView>
      {feedOffline ? (
        <View style={styles.offlineBanner} accessibilityLiveRegion="polite">
          <MaterialIcons name="cloud-off" size={17} color={C.terra} />
          <Text style={[styles.offlineText, { fontFamily: bodyFont }]}>
            {copy.offlineBanner}
          </Text>
          <Pressable
            onPress={() => void reloadFeed(true)}
            accessibilityRole="button"
            accessibilityLabel={copy.retry}
          >
            <Text style={[styles.offlineRetry, { fontFamily: mediumFont }]}>
              {copy.retry}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {feedError ? (
        <View style={styles.errorCard} accessibilityRole="alert">
          <View style={styles.errorIcon}>
            <MaterialIcons name="cloud-off" size={24} color={C.terra} />
          </View>
          <View style={styles.errorCopy}>
            <Text style={[styles.errorTitle, { fontFamily: mediumFont }]}>
              {copy.feedErrorTitle}
            </Text>
            <Text style={[styles.errorBody, { fontFamily: bodyFont }]}>
              {copy.feedErrorBody}
            </Text>
          </View>
          <Pressable
            onPress={() => void reloadFeed(true)}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel={copy.retry}
          >
            <Text style={[styles.retryText, { fontFamily: mediumFont }]}>
              {copy.retry}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {refreshing && !feed.length ? <FeedSkeleton /> : null}
    </View>
  );

  const footer = loadingMore ? (
    <View style={styles.feedFooter}>
      <ActivityIndicator color={C.terra} />
      <Text style={[styles.footerText, { fontFamily: bodyFont }]}>
        {copy.feedLoadingMore}
      </Text>
    </View>
  ) : !hasMore && feed.length ? (
    <Text style={[styles.endText, { fontFamily: bodyFont }]}>
      {copy.feedCaughtUp}
    </Text>
  ) : null;

  return (
    <ScreenContainer
      safeAreaClassName="bg-background"
      className="bg-background"
    >
      <FlatList
        data={visibleFeed}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          Platform.OS === "web" && styles.webContainer,
        ]}
        onScroll={handleScroll}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        onTouchStart={handleWebTouchStart}
        onTouchMove={handleWebTouchMove}
        onTouchEnd={handleWebTouchEnd}
        scrollEventThrottle={16}
        decelerationRate={Platform.OS === "ios" ? 0.985 : "normal"}
        overScrollMode="never"
        bounces
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reloadFeed(true)}
            tintColor={C.terra}
            colors={[C.terra]}
            progressBackgroundColor={C.paper}
          />
        }
      />
      {refreshNotice ? (
        <View style={styles.toast} accessibilityRole="alert">
          <MaterialIcons name="check-circle" size={18} color="#FFF" />
          <Text style={[styles.toastText, { fontFamily: mediumFont }]}>
            {copy.feedUpdated}
          </Text>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingBottom: 32 },
  webContainer: { width: "100%", maxWidth: 520, alignSelf: "center" },
  pullIndicator: {
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pullText: { color: C.terra, fontSize: 10, marginTop: 2 },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  topActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  iconAction: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    position: "relative",
  },
  alertBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: C.terra,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.paper,
  },
  alertBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "900" },
  avatarAction: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    marginLeft: 2,
  },
  heroTitle: {
    color: C.ink,
    fontSize: 26,
    lineHeight: 33,
    fontFamily: "Georgia",
    fontWeight: "700",
  },
  heroSub: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 24,
    marginBottom: 5,
    paddingTop: 1,
  },
  feedFilters: { marginBottom: 10, flexGrow: 0 },
  feedFilterContent: { alignItems: "center", paddingRight: 2 },
  sectionTitle: {
    color: C.ink,
    fontSize: 16,
    fontFamily: "Georgia",
    fontWeight: "700",
  },
  feedMode: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    backgroundColor: C.paper,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginRight: 6,
  },
  feedModeActive: {
    backgroundColor: C.primaryContainer,
    borderColor: C.primaryContainer,
  },
  feedModeText: { color: C.muted, fontSize: 10, fontWeight: "800" },
  feedModeTextActive: { color: C.terra },
  toast: {
    position: "absolute",
    bottom: 28,
    left: 18,
    right: 18,
    backgroundColor: C.green,
    padding: 13,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toastText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  feedFooter: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: { color: C.muted, fontSize: 11 },
  endText: {
    color: C.muted,
    fontSize: 11,
    textAlign: "center",
    paddingVertical: 18,
  },
  errorCard: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: "#E8C7BA",
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    shadowColor: C.ink,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  offlineBanner: {
    backgroundColor: "#EAF3EA",
    borderWidth: 1,
    borderColor: "#C9DEC9",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offlineText: {
    color: Colors.dark.leafGreen,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  offlineRetry: {
    color: C.terra,
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  errorIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FBE7DF",
    alignItems: "center",
    justifyContent: "center",
  },
  errorCopy: { flex: 1 },
  errorTitle: { color: C.ink, fontSize: 13, fontWeight: "900" },
  errorBody: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  retryButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: C.terra,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { color: C.ivory, fontSize: 11, fontWeight: "900" },
});

const heroStyles = StyleSheet.create({
  card: {
    minHeight: 136,
    backgroundColor: "#E7EFE8",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D3E1D5",
    padding: 13,
    marginTop: 3,
    marginBottom: 10,
    overflow: "hidden",
    position: "relative",
  },
  copy: { width: "78%", position: "relative", zIndex: 1 },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  eyebrowText: {
    color: C.green,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  title: { paddingTop: 0, paddingBottom: 0, fontSize: 21, lineHeight: 26 },
  subtitle: { marginTop: 2, maxWidth: 218, fontSize: 11, lineHeight: 15 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 34,
    alignSelf: "flex-start",
    backgroundColor: C.terra,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginTop: 7,
  },
  actionText: { color: C.card, fontSize: 10, fontWeight: "900" },
  illustration: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 108,
  },
  sun: {
    position: "absolute",
    right: -12,
    top: -12,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0C66E",
    opacity: 0.72,
  },
  bubble: {
    position: "absolute",
    right: 11,
    top: 48,
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: "#FFF8EA",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  people: {
    position: "absolute",
    right: 51,
    bottom: 9,
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#D4E7D7",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "8deg" }],
  },
});

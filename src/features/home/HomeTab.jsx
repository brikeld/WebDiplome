import PostsTab from '@/features/feed/PostsTab.jsx';

export default function HomeTab({
  profile,
  feedProfiles = null,
  viewerProfile = null,
  aiFeaturesEnabled = true,
  isGeneratingPosts = false,
  postRevealFlash = null,
  highlightedPostId = null,
  onHighlightPost,
  onPostHide,
  onPostTellMeMore,
  tellMeMorePostId = null,
  personaBadgePersona = null,
  onOpenProfile,
  deletedProfileIds = [],
}) {
  return (
    <div className="home-tab">
      <p className="home-top-label">for you</p>
      <PostsTab
        profile={profile}
        feedProfiles={feedProfiles}
        viewerProfile={viewerProfile}
        aiFeaturesEnabled={aiFeaturesEnabled}
        feedContext="home"
        isGeneratingPosts={isGeneratingPosts}
        postRevealFlash={postRevealFlash}
        highlightedPostId={highlightedPostId}
        onHighlightPost={onHighlightPost}
        onPostHide={onPostHide}
        onPostTellMeMore={onPostTellMeMore}
        tellMeMorePostId={tellMeMorePostId}
        personaBadgePersona={personaBadgePersona}
        onOpenProfile={onOpenProfile}
        deletedProfileIds={deletedProfileIds}
      />
    </div>
  );
}

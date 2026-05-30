import PostsTab from '@/features/feed/PostsTab.jsx';

export default function HomeTab({
  profile,
  feedProfiles = null,
  isGeneratingPosts = false,
  highlightedPostId = null,
  onHighlightPost,
  onPostHide,
  onPostTellMeMore,
  tellMeMorePostId = null,
  personaBadgePersona = null,
  onOpenProfile,
}) {
  return (
    <div className="home-tab">
      <p className="home-top-label">for you</p>
      <PostsTab
        profile={profile}
        feedProfiles={feedProfiles}
        feedContext="home"
        isGeneratingPosts={isGeneratingPosts}
        highlightedPostId={highlightedPostId}
        onHighlightPost={onHighlightPost}
        onPostHide={onPostHide}
        onPostTellMeMore={onPostTellMeMore}
        tellMeMorePostId={tellMeMorePostId}
        personaBadgePersona={personaBadgePersona}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}

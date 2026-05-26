import PostsTab from '@/features/feed/PostsTab.jsx';

export default function HomeTab({
  profile,
  isGeneratingPosts = false,
  highlightedPostId = null,
  onHighlightPost,
  personaBadgePersona = null,
}) {
  return (
    <div className="home-tab">
      <p className="home-top-label">for you</p>
      <PostsTab
        profile={profile}
        feedContext="home"
        isGeneratingPosts={isGeneratingPosts}
        highlightedPostId={highlightedPostId}
        onHighlightPost={onHighlightPost}
        personaBadgePersona={personaBadgePersona}
      />
    </div>
  );
}

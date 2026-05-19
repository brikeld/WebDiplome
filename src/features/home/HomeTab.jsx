import PostsTab from '@/features/feed/PostsTab.jsx';

export default function HomeTab({
  profile,
  isGeneratingPosts = false,
  onHidePost,
  hiddenPostIds,
}) {
  return (
    <div className="home-tab">
      <p className="home-top-label">for you</p>
      <PostsTab profile={profile} feedContext="home" isGeneratingPosts={isGeneratingPosts} onHidePost={onHidePost} hiddenPostIds={hiddenPostIds} />
    </div>
  );
}

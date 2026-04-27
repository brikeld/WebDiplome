import PostsTab from '@/features/feed/PostsTab.jsx';

export default function HomeTab({ profile }) {
  return (
    <div className="home-tab">
      <p className="home-top-label">for you</p>
      <PostsTab profile={profile} feedContext="home" />
    </div>
  );
}

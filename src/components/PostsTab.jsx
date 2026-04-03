import { posts } from '../data/posts.js';
import PostCard from './PostCard.jsx';

export default function PostsTab() {
  return <div>{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>;
}


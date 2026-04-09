import { useState, useEffect } from 'react';
import PostCard from './PostCard.jsx';

const PERSONA_COLORS = {
  productivite: '#2323FF',
  securite: '#FF4E00',
  popularite: '#CEFE46',
};

export default function PostsTab() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchPosts = () => {
      fetch('http://localhost:3001/api/profiles')
        .then((res) => {
          if (!res.ok) throw new Error('failed');
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          if (!Array.isArray(data) || data.length === 0) return;
          const profile = data[0];
          const raw = profile.personaPosts ?? [];
          setPosts(
            raw.map((p, i) => ({
              id: i,
              persona: p.persona,
              content: p.content,
              noteColor: PERSONA_COLORS[p.persona] ?? '#2323FF',
            })),
          );
        })
        .catch(() => {});
    };

    fetchPosts();
    const id = setInterval(fetchPosts, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

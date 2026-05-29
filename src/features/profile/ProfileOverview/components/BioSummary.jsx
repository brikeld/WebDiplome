import { PoFold } from './PoCard.jsx';

export default function BioSummary({ bio, expanded = false }) {
  if (!bio?.text) {
    return <p className="po-secondary">No self-summary harvested yet.</p>;
  }

  return (
    <>
      <blockquote className="po-bio-quote">{bio.preview || bio.text}</blockquote>
      <PoFold open={expanded}>
        {bio.text.length > (bio.preview?.length ?? 0) ? (
          <p className="po-bio-full">{bio.text}</p>
        ) : null}
      </PoFold>
    </>
  );
}

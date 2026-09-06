import { isDirectMedia, toEmbedUrl } from '../lib/media';

export default function MediaPlayer({ url, title = 'Lesson' }) {
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center bg-ink text-white/40">
        No media for this lesson
      </div>
    );
  }

  if (isDirectMedia(url)) {
    return (
      <video key={url} src={url} controls className="h-full w-full bg-black object-contain">
        <track kind="captions" />
      </video>
    );
  }

  return (
    <iframe
      title={title}
      src={toEmbedUrl(url)}
      className="h-full w-full"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

import api from './api';

export async function uploadFile(file, onProgress) {
  if (!file) throw new Error('No file selected');
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/upload', form, {
    onUploadProgress: (e) => {
      if (!onProgress || !e.total) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data.url;
}

export const toEmbedUrl = (url) => {
  if (!url) return '';
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url;
};

export const isDirectMedia = (url = '') =>
  /\/uploads\//.test(url) || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);

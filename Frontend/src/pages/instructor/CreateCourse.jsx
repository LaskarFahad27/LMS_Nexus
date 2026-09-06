import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ImagePlus, Plus, Trash2, Upload, Video } from 'lucide-react';
import api from '../../lib/api';
import { uploadFile, toEmbedUrl } from '../../lib/upload';
import { getError } from '../../lib/async';
import { useToast } from '../../context/ToastContext';

const emptyLesson = () => ({
  key: crypto.randomUUID(),
  title: '',
  content_type: 'video',
  video_url: '',
  videoFile: null,
  document_url: '',
  documentFile: null,
  content: '',
  duration: 10,
  is_preview: false,
});

const emptyModule = () => ({
  key: crypto.randomUUID(),
  title: 'New module',
  lessons: [emptyLesson()],
});

export default function CreateCourse() {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [thumbPreview, setThumbPreview] = useState('');
  const [thumbFile, setThumbFile] = useState(null);
  const [form, setForm] = useState({
    title: '',
    short_description: '',
    description: '',
    price: 4999,
    discount_percent: 0,
    category_id: '',
    level: 'Beginner',
    learning_outcomes: 'Master the core concepts\nBuild a real project',
    requirements: 'A laptop and curiosity',
    tags: 'learning',
  });
  const [modules, setModules] = useState([emptyModule()]);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  const setMod = (index, next) => {
    setModules((list) => list.map((m, i) => (i === index ? next : m)));
  };

  const addLesson = (moduleIndex) => {
    const mod = modules[moduleIndex];
    setMod(moduleIndex, { ...mod, lessons: [...mod.lessons, emptyLesson()] });
  };

  const publish = async (submitAfter) => {
    if (!form.title.trim()) return error('Add a course title');
    if (!form.description.trim()) return error('Add a course description');
    setSaving(true);
    try {
      setProgress('Uploading thumbnail...');
      let thumbnail_url = thumbPreview.startsWith('http') ? thumbPreview : '';
      if (thumbFile) thumbnail_url = await uploadFile(thumbFile);

      setProgress('Creating course...');
      const { data } = await api.post('/courses', {
        ...form,
        price: Number(form.price),
        discount_percent: Number(form.discount_percent) || 0,
        learning_outcomes: form.learning_outcomes.split('\n').filter(Boolean),
        requirements: form.requirements.split('\n').filter(Boolean),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        thumbnail_url: thumbnail_url || undefined,
      });
      const course = data.course;

      for (let mi = 0; mi < modules.length; mi++) {
        const mod = modules[mi];
        setProgress(`Saving module ${mi + 1}...`);
        const { data: modRes } = await api.post(`/courses/${course.id}/modules`, {
          title: mod.title || `Module ${mi + 1}`,
          sequence_order: mi + 1,
        });

        for (let li = 0; li < mod.lessons.length; li++) {
          const lesson = mod.lessons[li];
          setProgress(`Uploading lesson ${li + 1} in module ${mi + 1}...`);
          let video_url = toEmbedUrl(lesson.video_url);
          let document_url = lesson.document_url;
          if (lesson.videoFile) video_url = await uploadFile(lesson.videoFile);
          if (lesson.documentFile) document_url = await uploadFile(lesson.documentFile);

          await api.post(`/courses/modules/${modRes.module.id}/lessons`, {
            title: lesson.title || `Lesson ${li + 1}`,
            content_type: lesson.content_type,
            video_url,
            document_url,
            content: lesson.content,
            duration: Number(lesson.duration) || 0,
            is_preview: !!lesson.is_preview,
            sequence_order: li + 1,
          });
        }
      }

      let finalCourse = course;
      if (submitAfter) {
        setProgress('Submitting for review...');
        const submitted = await api.post(`/courses/${course.id}/submit`);
        finalCourse = submitted.data.course;
        success('Course submitted for admin approval');
      } else {
        success('Draft saved. You can submit it when ready.');
      }

      setCreated(finalCourse);
      setProgress('');
    } catch (err) {
      error(getError(err, 'Could not save course'));
      setProgress('');
    } finally {
      setSaving(false);
    }
  };

  const submitExisting = async () => {
    if (!created) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/courses/${created.id}/submit`);
      setCreated(data.course);
      success('Submitted for admin approval');
    } catch (err) {
      error(getError(err, 'Submit failed'));
    } finally {
      setSaving(false);
    }
  };

  const generateQuiz = async () => {
    if (!created) return;
    setSaving(true);
    try {
      await api.post(`/courses/${created.id}/ai-quiz`, { count: 5 });
      success('AI quiz generated for this course');
    } catch (err) {
      error(getError(err, 'Quiz generation failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="section-kicker">Course studio</div>
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">Create a course</h1>
        <p className="text-fog mt-1">Upload a thumbnail, lessons, videos, and class notes from your device.</p>
      </div>

      {created && (
        <div className="rounded-lg border border-cyan/30 bg-cyan/10 p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold">{created.title}</div>
            <div className="text-sm text-fog capitalize">Status: {created.status}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {created.status === 'draft' && (
              <button disabled={saving} onClick={submitExisting} className="btn-primary !py-2 !px-4 !text-sm">
                Submit for approval
              </button>
            )}
            <button disabled={saving} onClick={generateQuiz} className="btn-secondary !py-2 !px-4 !text-sm !text-ink">
              Generate AI quiz
            </button>
            <button onClick={() => navigate('/instructor/courses')} className="btn-ink !py-2 !px-4 !text-sm">
              View my courses
            </button>
          </div>
        </div>
      )}

      <section className="rounded-lg border border-line bg-white p-6 space-y-4">
        <h2 className="font-display text-xl font-bold">Course details</h2>
        <Field label="Course title">
          <input className="input-field" placeholder="e.g. Modern React Mastery" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Short description">
          <textarea className="input-field" rows={2} placeholder="A one-line summary students see on cards" value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
        </Field>
        <Field label="Full description">
          <textarea className="input-field" rows={5} placeholder="What the course covers and who it is for" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Price (BDT)">
            <input type="number" step="1" min="0" className="input-field" placeholder="4999" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Discount %">
            <input type="number" className="input-field" placeholder="0" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
          </Field>
          <Field label="Category">
            <select className="input-field" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Select a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Level">
          <select className="input-field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
          </select>
        </Field>
        <Field label="Learning outcomes" hint="One outcome per line">
          <textarea className="input-field" rows={3} placeholder="Master the core concepts" value={form.learning_outcomes} onChange={(e) => setForm({ ...form, learning_outcomes: e.target.value })} />
        </Field>
        <Field label="Requirements" hint="One requirement per line">
          <textarea className="input-field" rows={2} placeholder="A laptop and curiosity" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
        </Field>
        <Field label="Tags" hint="Comma separated">
          <input className="input-field" placeholder="react, javascript, frontend" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </Field>
      </section>

      <section className="rounded-lg border border-line bg-white p-6 space-y-4">
        <h2 className="font-display text-xl font-bold">Course thumbnail</h2>
        <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-line bg-paper-2 text-fog hover:border-cyan overflow-hidden">
          {thumbPreview ? (
            <img src={thumbPreview} alt="Thumbnail preview" className="h-56 w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10">
              <ImagePlus />
              <span className="font-semibold">Upload cover image from your device</span>
              <span className="text-xs">PNG or JPG, landscape recommended</span>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setThumbFile(file);
              setThumbPreview(URL.createObjectURL(file));
            }}
          />
        </label>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Curriculum</h2>
          <button
            type="button"
            onClick={() => setModules((list) => [...list, emptyModule()])}
            className="inline-flex items-center gap-1 text-sm font-bold text-cyan-deep"
          >
            <Plus size={16} /> Add module
          </button>
        </div>

        {modules.map((mod, mi) => (
          <div key={mod.key} className="rounded-lg border border-line bg-white p-5 space-y-4">
            <div className="flex gap-2 items-end">
              <Field label="Module title" className="flex-1">
                <input className="input-field" value={mod.title} onChange={(e) => setMod(mi, { ...mod, title: e.target.value })} placeholder="e.g. Foundations" />
              </Field>
              {modules.length > 1 && (
                <button type="button" onClick={() => setModules((list) => list.filter((_, i) => i !== mi))} className="rounded-xl border border-line px-3 text-coral">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {mod.lessons.map((lesson, li) => (
              <div key={lesson.key} className="rounded-2xl bg-paper-2 p-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <Field label="Lesson title" className="flex-1 min-w-[12rem]">
                    <input className="input-field" placeholder="e.g. Component mental models" value={lesson.title} onChange={(e) => {
                      const lessons = [...mod.lessons];
                      lessons[li] = { ...lesson, title: e.target.value };
                      setMod(mi, { ...mod, lessons });
                    }} />
                  </Field>
                  <Field label="Content type" className="w-36">
                    <select
                      className="input-field"
                      value={lesson.content_type}
                      onChange={(e) => {
                        const lessons = [...mod.lessons];
                        lessons[li] = { ...lesson, content_type: e.target.value };
                        setMod(mi, { ...mod, lessons });
                      }}
                    >
                      <option value="video">Video</option>
                      <option value="document">Class notes</option>
                      <option value="text">Written lesson</option>
                    </select>
                  </Field>
                </div>

                {lesson.content_type === 'video' && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-sm cursor-pointer">
                      <Video size={16} className="text-cyan-deep" />
                      <span className="truncate">{lesson.videoFile ? lesson.videoFile.name : 'Upload video from device'}</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          const lessons = [...mod.lessons];
                          lessons[li] = { ...lesson, videoFile: file || null };
                          setMod(mi, { ...mod, lessons });
                        }}
                      />
                    </label>
                    <Field label="Video URL">
                      <input
                        className="input-field"
                        placeholder="Or paste YouTube / video URL"
                        value={lesson.video_url}
                        onChange={(e) => {
                          const lessons = [...mod.lessons];
                          lessons[li] = { ...lesson, video_url: e.target.value };
                          setMod(mi, { ...mod, lessons });
                        }}
                      />
                    </Field>
                  </div>
                )}

                <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-sm cursor-pointer">
                  <FileText size={16} className="text-blue" />
                  <span className="truncate">
                    {lesson.documentFile ? lesson.documentFile.name : 'Upload class notes / PDF / extra files'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      const lessons = [...mod.lessons];
                      lessons[li] = { ...lesson, documentFile: file || null };
                      setMod(mi, { ...mod, lessons });
                    }}
                  />
                </label>

                <Field label="Lesson notes">
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Optional written notes for students"
                    value={lesson.content}
                    onChange={(e) => {
                      const lessons = [...mod.lessons];
                      lessons[li] = { ...lesson, content: e.target.value };
                      setMod(mi, { ...mod, lessons });
                    }}
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    Duration (min)
                    <input
                      type="number"
                      className="input-field !w-24"
                      value={lesson.duration}
                      onChange={(e) => {
                        const lessons = [...mod.lessons];
                        lessons[li] = { ...lesson, duration: e.target.value };
                        setMod(mi, { ...mod, lessons });
                      }}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lesson.is_preview}
                      onChange={(e) => {
                        const lessons = [...mod.lessons];
                        lessons[li] = { ...lesson, is_preview: e.target.checked };
                        setMod(mi, { ...mod, lessons });
                      }}
                    />
                    Free preview
                  </label>
                  {mod.lessons.length > 1 && (
                    <button
                      type="button"
                      className="ml-auto text-coral font-semibold"
                      onClick={() => setMod(mi, { ...mod, lessons: mod.lessons.filter((_, i) => i !== li) })}
                    >
                      Remove lesson
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button type="button" onClick={() => addLesson(mi)} className="text-sm font-bold text-cyan-deep inline-flex items-center gap-1">
              <Plus size={14} /> Add lesson
            </button>
          </div>
        ))}
      </section>

      <div className="sticky bottom-4 rounded-lg border border-line bg-white/90 backdrop-blur-xl p-4 flex flex-wrap gap-3 items-center">
        {progress && <div className="text-sm text-cyan-deep font-semibold">{progress}</div>}
        <div className="ml-auto flex gap-2">
          <button disabled={saving} onClick={() => publish(false)} className="btn-secondary !text-ink">
            {saving ? 'Saving...' : 'Save draft'}
          </button>
          <button disabled={saving} onClick={() => publish(true)} className="btn-primary">
            <Upload size={16} /> {saving ? 'Working...' : 'Save & submit for approval'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, className = '', children }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="text-[11px] text-fog">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api';

export default function QuizPage() {
  const { quizId, slug } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get(`/quizzes/${quizId}`).then((r) => {
      setQuiz(r.data.quiz);
      setQuestions(r.data.questions || []);
    });
  }, [quizId]);

  const submit = async (e) => {
    e.preventDefault();
    const payload = questions.map((q) => ({
      question_id: q.id,
      selected: answers[q.id] ?? -1,
    }));
    const { data } = await api.post(`/quizzes/${quizId}/attempt`, { answers: payload });
    setResult(data);
  };

  if (!quiz) return <div className="min-h-screen mesh-bg flex items-center justify-center text-fog">Loading quiz...</div>;

  return (
    <div className="min-h-screen mesh-bg">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to={`/learn/${slug}`} className="text-sm text-accent-deep hover:underline">← Back to course</Link>
        <h1 className="font-display text-3xl mt-4 mb-2">{quiz.title}</h1>
        <p className="text-fog mb-8">{quiz.description} · Pass score {quiz.pass_score}%</p>

        {result ? (
          <div className="rounded-3xl border border-line bg-white p-6 space-y-4">
            <div className={`font-display text-4xl ${result.passed ? 'text-accent-deep' : 'text-coral'}`}>
              {result.score}%
            </div>
            <div className="text-fog">{result.passed ? 'Passed — great work!' : 'Keep practicing and try again.'}</div>
            <div className="space-y-3">
              {result.results.map((r, i) => (
                <div key={r.question_id} className={`rounded-xl p-3 text-sm ${r.is_correct ? 'bg-accent/10' : 'bg-coral/10'}`}>
                  <div className="font-semibold mb-1">Q{i + 1}</div>
                  <div className="text-fog">{r.explanation}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="font-semibold mb-3">{idx + 1}. {q.question}</div>
                <div className="space-y-2">
                  {(q.options || []).map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 text-sm rounded-xl border border-line px-3 py-2 cursor-pointer hover:bg-surface">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === oi}
                        onChange={() => setAnswers({ ...answers, [q.id]: oi })}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button className="rounded-full bg-ink text-white px-6 py-3 font-semibold">Submit quiz</button>
          </form>
        )}
      </div>
    </div>
  );
}

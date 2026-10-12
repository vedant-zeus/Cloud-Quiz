import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Award,
  Eye,
  EyeOff,
  Edit,
  Sparkles,
} from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { Quiz, Question } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';

export const QuizPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(true);

  useEffect(() => {
    async function loadPreview() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await quizApi.getQuizById(id);
        setQuiz(data);
      } catch (err) {
        console.error('Failed to load quiz preview:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPreview();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <LoadingSkeleton className="h-8 w-1/3" />
        <LoadingSkeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <Card className="p-8 text-center bg-white max-w-lg mx-auto">
        <h3 className="text-lg font-bold text-slate-900">Quiz not found</h3>
        <Link to="/quizzes" className="mt-4 inline-block">
          <Button variant="primary">Return to Quizzes</Button>
        </Link>
      </Card>
    );
  }

  const questions: Question[] = quiz.questions || [];
  const currentQ: Question | undefined = questions[currentIndex];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/quizzes/${quiz.id}/edit`}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{quiz.title}</h1>
              <Badge status={quiz.status} />
            </div>
            <p className="text-xs text-slate-500">Live Stage & Participant View Simulation</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnswer(!showAnswer)}
            icon={showAnswer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          >
            {showAnswer ? 'Hide Answers' : 'Reveal Answers'}
          </Button>
          <Link to={`/quizzes/${quiz.id}/edit`}>
            <Button variant="primary" size="sm" icon={<Edit className="h-3.5 w-3.5" />}>
              Back to Editor
            </Button>
          </Link>
        </div>
      </div>

      {questions.length === 0 ? (
        <Card className="p-12 text-center bg-white border border-dashed border-slate-300">
          <Sparkles className="h-8 w-8 text-indigo-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No questions available to preview</h3>
          <p className="text-xs text-slate-500 mt-1">
            Add questions in the editor to test preview mode.
          </p>
          <div className="mt-4">
            <Link to={`/quizzes/${quiz.id}/edit`}>
              <Button variant="primary" size="sm">
                Open Quiz Editor
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Question Stage Card */}
          <Card className="p-6 sm:p-8 bg-white border border-slate-200/90 shadow-md">
            {/* Top Bar: Question Index, Points, Timer */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Question {currentIndex + 1} of {questions.length}
              </span>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md">
                  <Award className="h-4 w-4 text-amber-500" />
                  {currentQ?.points} Points
                </span>
                <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  {currentQ?.timeLimitSeconds}s Limit
                </span>
              </div>
            </div>

            {/* Question Text */}
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug mb-8">
              {currentQ?.text}
            </h2>

            {/* Answer Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {currentQ?.options.map((option, idx) => {
                const isCorrect = showAnswer && currentQ.correctAnswer === idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-sm font-medium transition-all ${
                      isCorrect
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-400/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 text-slate-800'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isCorrect
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {isCorrect && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded">
                        Correct
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Navigation Controls & Question Selector */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((idx) => Math.max(idx - 1, 0))}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Previous
            </Button>

            {/* Question Indicator Numbers */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-2">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold transition-all ${
                    currentIndex === idx
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === questions.length - 1}
              onClick={() => setCurrentIndex((idx) => Math.min(idx + 1, questions.length - 1))}
              icon={<ChevronRight className="h-4 w-4" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

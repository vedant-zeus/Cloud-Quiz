import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  PlusCircle,
  Trash2,
  ArrowUp,
  ArrowDown,
  Globe,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Award,
  Save,
  Edit2,
} from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { questionApi } from '../../services/questionApi';
import { Quiz, Question } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';

// Question Schema
const questionFormSchema = z.object({
  text: z.string().trim().min(1, 'Question text cannot be empty').max(1000),
  option0: z.string().trim().min(1, 'Option 1 cannot be empty').max(500),
  option1: z.string().trim().min(1, 'Option 2 cannot be empty').max(500),
  option2: z.string().trim().min(1, 'Option 3 cannot be empty').max(500),
  option3: z.string().trim().min(1, 'Option 4 cannot be empty').max(500),
  correctAnswer: z.coerce.number().int().min(0).max(3),
  points: z.coerce.number().int().min(1, 'Points must be at least 1').max(1000).default(100),
  timeLimitSeconds: z.coerce
    .number()
    .int()
    .min(5, 'Time limit must be at least 5s')
    .max(180, 'Time limit must not exceed 180s')
    .default(20),
});

type QuestionFormValues = z.infer<typeof questionFormSchema>;

export const QuizEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Metadata editing state
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // Question Modal state
  const [questionModal, setQuestionModal] = useState<{
    isOpen: boolean;
    editingQuestion: Question | null;
  }>({
    isOpen: false,
    editingQuestion: null,
  });

  // Reorder loading state
  const [reordering, setReordering] = useState(false);

  // Question delete state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    question: Question | null;
    loading: boolean;
  }>({
    isOpen: false,
    question: null,
    loading: false,
  });

  const loadQuiz = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await quizApi.getQuizById(id);
      setQuiz(data);
      setQuestions(data.questions || []);
      setMetaTitle(data.title);
      setMetaDesc(data.description || '');
    } catch (err: unknown) {
      const error = err as { friendlyMessage?: string };
      setStatusMessage({
        type: 'error',
        text: error.friendlyMessage || 'Failed to load quiz details',
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // Question Form Hook
  const {
    register: registerQ,
    handleSubmit: handleQSubmit,
    reset: resetQForm,
    watch: watchQ,
    setValue: setQValue,
    formState: { errors: qErrors, isSubmitting: isSubmittingQ },
  } = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      text: '',
      option0: '',
      option1: '',
      option2: '',
      option3: '',
      correctAnswer: 0,
      points: 100,
      timeLimitSeconds: 20,
    },
  });

  const selectedCorrectAnswer = watchQ('correctAnswer');

  const openAddQuestion = () => {
    resetQForm({
      text: '',
      option0: '',
      option1: '',
      option2: '',
      option3: '',
      correctAnswer: 0,
      points: 100,
      timeLimitSeconds: 20,
    });
    setQuestionModal({ isOpen: true, editingQuestion: null });
  };

  const openEditQuestion = (q: Question) => {
    resetQForm({
      text: q.text,
      option0: q.options[0] || '',
      option1: q.options[1] || '',
      option2: q.options[2] || '',
      option3: q.options[3] || '',
      correctAnswer: q.correctAnswer,
      points: q.points,
      timeLimitSeconds: q.timeLimitSeconds,
    });
    setQuestionModal({ isOpen: true, editingQuestion: q });
  };

  const onQuestionFormSubmit = async (values: QuestionFormValues) => {
    if (!id) return;
    try {
      const options = [values.option0, values.option1, values.option2, values.option3];

      if (questionModal.editingQuestion) {
        // Update question
        await questionApi.updateQuestion(id, questionModal.editingQuestion.id, {
          text: values.text,
          options,
          correctAnswer: values.correctAnswer,
          points: values.points,
          timeLimitSeconds: values.timeLimitSeconds,
        });
        setStatusMessage({ type: 'success', text: 'Question updated successfully' });
      } else {
        // Add question
        await questionApi.addQuestion(id, {
          text: values.text,
          options,
          correctAnswer: values.correctAnswer,
          points: values.points,
          timeLimitSeconds: values.timeLimitSeconds,
        });
        setStatusMessage({ type: 'success', text: 'Question added successfully' });
      }

      setQuestionModal({ isOpen: false, editingQuestion: null });
      loadQuiz();
    } catch (err: unknown) {
      const error = err as { friendlyMessage?: string };
      setStatusMessage({
        type: 'error',
        text: error.friendlyMessage || 'Failed to save question',
      });
    }
  };

  // Reordering questions
  const handleMoveQuestion = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!id || reordering) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    try {
      setReordering(true);
      // Create clone and swap
      const updated = [...questions];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;

      // Build reorder payload with 0-based consecutive indices
      const payload = updated.map((item, idx) => ({
        questionId: item.id,
        orderIndex: idx,
      }));

      const result = await questionApi.reorderQuestions(id, payload);
      setQuestions(result);
      setStatusMessage({ type: 'success', text: 'Questions reordered successfully' });
    } catch (err: unknown) {
      const error = err as { friendlyMessage?: string };
      setStatusMessage({
        type: 'error',
        text: error.friendlyMessage || 'Failed to reorder questions',
      });
      loadQuiz();
    } finally {
      setReordering(false);
    }
  };

  // Delete question
  const handleDeleteConfirm = async () => {
    if (!id || !deleteModal.question) return;
    try {
      setDeleteModal((prev) => ({ ...prev, loading: true }));
      await questionApi.deleteQuestion(id, deleteModal.question.id);
      setDeleteModal({ isOpen: false, question: null, loading: false });
      setStatusMessage({ type: 'success', text: 'Question deleted successfully' });
      loadQuiz();
    } catch (err: unknown) {
      const error = err as { friendlyMessage?: string };
      setStatusMessage({
        type: 'error',
        text: error.friendlyMessage || 'Failed to delete question',
      });
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Save metadata
  const handleSaveMeta = async () => {
    if (!id || !metaTitle.trim()) return;
    try {
      setIsSavingMeta(true);
      const updated = await quizApi.updateQuiz(id, {
        title: metaTitle.trim(),
        description: metaDesc.trim() || null,
      });
      setQuiz((prev) => (prev ? { ...prev, title: updated.title, description: updated.description } : null));
      setIsEditingMeta(false);
      setStatusMessage({ type: 'success', text: 'Quiz metadata saved' });
    } catch (err: unknown) {
      const error = err as { friendlyMessage?: string };
      setStatusMessage({
        type: 'error',
        text: error.friendlyMessage || 'Failed to update quiz metadata',
      });
    } finally {
      setIsSavingMeta(false);
    }
  };

  // Publish
  const handlePublish = async () => {
    if (!id) return;
    if (questions.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'A quiz must contain at least one question before it can be published.',
      });
      return;
    }

    try {
      await quizApi.publishQuiz(id);
      setStatusMessage({ type: 'success', text: 'Quiz published successfully!' });
      loadQuiz();
    } catch (err: unknown) {
      const error = err as { friendlyMessage?: string };
      setStatusMessage({
        type: 'error',
        text: error.friendlyMessage || 'Failed to publish quiz',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <LoadingSkeleton className="h-8 w-1/3" />
        <LoadingSkeleton className="h-40 w-full" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <Card className="p-8 text-center bg-white">
        <h3 className="text-lg font-bold text-slate-900">Quiz not found</h3>
        <p className="text-sm text-slate-500 mt-1">The requested quiz does not exist or was deleted.</p>
        <Link to="/quizzes" className="mt-4 inline-block">
          <Button variant="primary">Return to Quizzes</Button>
        </Link>
      </Card>
    );
  }

  const isArchived = quiz.status === 'ARCHIVED';

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/quizzes"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{quiz.title}</h1>
              <Badge status={quiz.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configuring round questions, point values, and countdown limits
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link to={`/quizzes/${quiz.id}/preview`}>
            <Button variant="outline" size="sm" icon={<Eye className="h-4 w-4" />}>
              Preview
            </Button>
          </Link>

          {quiz.status === 'DRAFT' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Globe className="h-4 w-4" />}
              onClick={handlePublish}
            >
              Publish Quiz
            </Button>
          )}
        </div>
      </div>

      {/* Alert Banner */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between gap-2 p-3.5 rounded-xl border text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quiz Metadata Box */}
      <Card className="p-6 bg-white">
        {isEditingMeta ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Quiz Title
              </label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Description / Context
              </label>
              <textarea
                rows={3}
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMetaTitle(quiz.title);
                  setMetaDesc(quiz.description || '');
                  setIsEditingMeta(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={isSavingMeta}
                onClick={handleSaveMeta}
                icon={<Save className="h-3.5 w-3.5" />}
              >
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">{quiz.title}</h2>
              <p className="text-xs text-slate-500">
                {quiz.description || 'No description entered for this quiz.'}
              </p>
            </div>
            {!isArchived && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingMeta(true)}
                icon={<Edit2 className="h-3.5 w-3.5" />}
              >
                Edit Details
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Questions Section Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Questions ({questions.length})
          </h2>
          <p className="text-xs text-slate-500">
            Arrange questions in sequence. Exactly 4 answer options with 1 verified correct answer.
          </p>
        </div>

        {!isArchived && (
          <Button
            variant="primary"
            size="sm"
            onClick={openAddQuestion}
            icon={<PlusCircle className="h-4 w-4" />}
          >
            Add Question
          </Button>
        )}
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <Card className="p-10 text-center bg-white border border-dashed border-slate-300">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No questions added yet</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            A quiz requires at least one question to be published. Add multiple-choice questions with time limits and point allocations.
          </p>
          {!isArchived && (
            <div className="mt-4">
              <Button variant="primary" size="sm" onClick={openAddQuestion} icon={<PlusCircle className="h-4 w-4" />}>
                Add First Question
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <Card key={q.id} className="p-5 bg-white border border-slate-200 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                {/* Left: Question info & options */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">{q.text}</h3>
                  </div>

                  {/* 4 Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctAnswer === optIdx;
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg text-xs border transition-all ${
                            isCorrect
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-medium'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="truncate flex-1">{opt}</span>
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider shrink-0 bg-emerald-100 px-1.5 py-0.5 rounded">
                              Correct
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Points & Timer badges */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 pl-9 pt-1">
                    <span className="flex items-center gap-1 font-medium text-indigo-600">
                      <Award className="h-3.5 w-3.5" />
                      {q.points} Points
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {q.timeLimitSeconds}s Limit
                    </span>
                  </div>
                </div>

                {/* Right: Actions (Order buttons, Edit, Delete) */}
                {!isArchived && (
                  <div className="flex items-center gap-1.5 self-end md:self-start border-t md:border-t-0 pt-3 md:pt-0">
                    <button
                      onClick={() => handleMoveQuestion(idx, 'UP')}
                      disabled={idx === 0 || reordering}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      title="Move Up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleMoveQuestion(idx, 'DOWN')}
                      disabled={idx === questions.length - 1 || reordering}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      title="Move Down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditQuestion(q)}
                      icon={<Edit2 className="h-3.5 w-3.5" />}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleteModal({ isOpen: true, question: q, loading: false })}
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      <Modal
        isOpen={questionModal.isOpen}
        onClose={() => setQuestionModal({ isOpen: false, editingQuestion: null })}
        title={questionModal.editingQuestion ? 'Edit Competition Question' : 'Add New Question'}
        maxWidth="lg"
      >
        <form onSubmit={handleQSubmit(onQuestionFormSubmit)} className="space-y-4">
          {/* Question Text */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Question Text <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              {...registerQ('text')}
              placeholder="e.g. Which AWS service is best suited for serverless event-driven computing?"
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                qErrors.text
                  ? 'border-rose-300 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
              }`}
            />
            {qErrors.text && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{qErrors.text.message}</p>
            )}
          </div>

          {/* 4 Options with Radio selection for Correct Answer */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Answer Options & Correct Choice <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Provide 4 options and click the circular selector on the option that is correct.
            </p>

            {[0, 1, 2, 3].map((optIndex) => {
              const fieldName = `option${optIndex}` as keyof QuestionFormValues;
              const isSelected = selectedCorrectAnswer === optIndex;
              return (
                <div
                  key={optIndex}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                    isSelected ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setQValue('correctAnswer', optIndex)}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-500 border border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {String.fromCharCode(65 + optIndex)}
                  </button>

                  <input
                    type="text"
                    {...registerQ(fieldName as 'option0' | 'option1' | 'option2' | 'option3')}
                    placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                    className="flex-1 bg-transparent px-2 py-1 text-sm text-slate-900 focus:outline-none placeholder:text-slate-400"
                  />

                  {isSelected && (
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider px-2 py-0.5 bg-emerald-100 rounded-md">
                      Correct Answer
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Points & Time limit Row */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Points Awarded
              </label>
              <input
                type="number"
                {...registerQ('points')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              />
              {qErrors.points && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{qErrors.points.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Time Limit (Seconds: 5 - 180)
              </label>
              <input
                type="number"
                {...registerQ('timeLimitSeconds')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
              />
              {qErrors.timeLimitSeconds && (
                <p className="mt-1 text-xs text-rose-600 font-medium">
                  {qErrors.timeLimitSeconds.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              type="button"
              onClick={() => setQuestionModal({ isOpen: false, editingQuestion: null })}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isSubmittingQ}>
              {questionModal.editingQuestion ? 'Update Question' : 'Add Question'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Question Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, question: null, loading: false })}
        title="Delete Question"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this question? Order indices for subsequent questions will be automatically normalized.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ isOpen: false, question: null, loading: false })}
              disabled={deleteModal.loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteModal.loading}
              onClick={handleDeleteConfirm}
            >
              Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

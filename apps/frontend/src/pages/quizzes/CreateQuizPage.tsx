import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, AlertCircle, Save } from 'lucide-react';
import { quizApi } from '../../services/quizApi';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

const createQuizSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Quiz title cannot be empty')
    .max(255, 'Quiz title cannot exceed 255 characters'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional(),
});

type CreateQuizFormValues = z.infer<typeof createQuizSchema>;

export const CreateQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateQuizFormValues>({
    resolver: zodResolver(createQuizSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  const onSubmit = async (values: CreateQuizFormValues) => {
    try {
      setServerError(null);
      const created = await quizApi.createQuiz({
        title: values.title,
        description: values.description || undefined,
      });
      // Redirect directly to the quiz editor so host can add questions
      navigate(`/quizzes/${created.id}/edit`);
    } catch (err: unknown) {
      const error = err as { friendlyMessage?: string };
      setServerError(error.friendlyMessage || 'Failed to create quiz');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link
          to="/quizzes"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Quiz</h1>
          <p className="text-xs text-slate-500">
            Set up the basic details for your competition round
          </p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 bg-white">
        {serverError && (
          <div className="mb-6 flex items-center gap-2.5 rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Quiz Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              {...register('title')}
              placeholder="e.g. AWS Cloud Architecture Finals 2026"
              className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                errors.title
                  ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
              }`}
            />
            {errors.title && (
              <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Description / Instructions (Optional)
            </label>
            <textarea
              rows={4}
              {...register('description')}
              placeholder="Provide context, guidelines, or details for participant teams..."
              className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all resize-y ${
                errors.description
                  ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100'
              }`}
            />
            {errors.description && (
              <p className="mt-1.5 text-xs text-rose-600 font-medium">
                {errors.description.message}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Max 1,000 characters. You will configure questions in the next step.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link to="/quizzes">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button
              variant="primary"
              type="submit"
              loading={isSubmitting}
              icon={<Save className="h-4 w-4" />}
            >
              Save & Continue to Questions
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Home } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <HelpCircle className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">404</h1>
        <h2 className="text-lg font-bold text-slate-800">Page Not Found</h2>
        <p className="text-sm text-slate-500">
          The competition resource, quiz link, or dashboard page you requested does not exist.
        </p>
        <div className="pt-2">
          <Link to="/dashboard">
            <Button variant="primary" icon={<Home className="h-4 w-4" />}>
              Return to Host Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

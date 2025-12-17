import React from 'react';
import { LoadingSpinner } from '../icons/LoadingSpinner';

export const PageLoader: React.FC<{ message: string }> = ({ message }) => (
    <div className="min-h-screen flex flex-col items-center justify-center text-center">
        <LoadingSpinner />
        <p className="text-xl mt-4 text-slate-600">{message}</p>
    </div>
);

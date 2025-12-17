import React from 'react';
import { QRCodeDisplay } from './QRCodeDisplay';

export const PersistentQRCode: React.FC<{ quizId: string }> = ({ quizId }) => {
    const joinUrl = `${window.location.origin}${window.location.pathname}#/join/${quizId}`;

    if (!quizId) return null;

    return (
        <div className="fixed bottom-20 left-4 z-50 p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-xl text-center animate-fade-in">
            <h3 className="text-sm font-bold mb-2 text-slate-800">Scan to Join!</h3>
            <QRCodeDisplay text={joinUrl} size={100} cellSize={3} margin={4} />
            <p className="mt-2 text-lg font-extrabold tracking-widest bg-slate-100 p-2 rounded-lg text-slate-800">{quizId}</p>
        </div>
    );
};

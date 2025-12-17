import React from 'react';

export const SurveyResultsChart: React.FC<{ options: string[], answerCounts: number[] }> = ({ options, answerCounts }) => {
    const totalVotes = answerCounts.reduce((sum, count) => sum + count, 0);
    const maxCount = Math.max(...answerCounts, 1);

    return (
        <div className="w-full max-w-2xl mx-auto space-y-4">
            {options.map((opt, i) => {
                const percentage = totalVotes === 0 ? 0 : (answerCounts[i] / totalVotes) * 100;
                return (
                    <div key={i} className="bg-white border rounded-lg p-3">
                        <div className="flex justify-between items-center text-lg font-semibold text-slate-800 mb-1">
                            <span>{opt}</span>
                            <span className="text-slate-500">{answerCounts[i]} ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="bg-slate-200 rounded-full h-4 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-gl-orange-500 to-yellow-400 h-4 rounded-full"
                                style={{ width: `${(answerCounts[i] / maxCount) * 100}%`, transition: 'width 0.5s ease-in-out' }}
                            ></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

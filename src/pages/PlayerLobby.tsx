

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import type { Quiz, Player } from '../../types';
import { GameState, Clan } from '../../types';
import { PageLoader } from '../components/PageLoader';
import { FiftyFiftyIcon } from '../icons/FiftyFiftyIcon';
import { PointDoublerIcon } from '../icons/PointDoublerIcon';
import Card from '../components/Card';

const PlayerLobby = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const navigate = useNavigate();
    const playerId = useMemo(() => quizId ? localStorage.getItem(`quiz-player-${quizId}`) : null, [quizId]);

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const currentPlayer = useMemo(() => allPlayers.find(p => p.id === playerId), [allPlayers, playerId]);

    useEffect(() => {
        if (!quizId || !playerId) {
            navigate('/join');
            return;
        }
        
        const unsubQuiz = db.collection('quizzes').doc(quizId).onSnapshot((docSnap) => {
            const quizData = docSnap.data() as Quiz;
            setQuiz(quizData);
            if (quizData && quizData.gameState !== GameState.LOBBY) {
                navigate(`/quiz/player/${quizId}/${playerId}`);
            }
        });

        const unsubPlayers = db.collection('quizzes').doc(quizId).collection('players').onSnapshot((snapshot) => {
            const playersData = snapshot.docs.map(doc => doc.data() as Player);
            setAllPlayers(playersData);
        });

        return () => {
            unsubQuiz();
            unsubPlayers();
        };
    }, [quizId, playerId, navigate]);

    if (!quiz) {
        return <PageLoader message="Joining lobby..." />;
    }

    if (!quiz.config.clanBased) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center p-4 text-center animate-fade-in">
                <h1 className="text-4xl font-bold">You're in!</h1>
                <p className="text-slate-600 text-xl mt-2 mb-6">See your name on the host's screen.</p>
                
                <div className="text-2xl font-semibold bg-white shadow-lg p-8 rounded-2xl mb-6">
                    Get ready to play...
                </div>
                
                <div className="w-full max-w-2xl mt-8 animate-slide-in-up text-left">
                    <h2 className="text-lg font-bold text-center mb-3 text-slate-600">Your Lifelines</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* 50:50 Lifeline */}
                        <div className="flex items-center gap-4 p-3 bg-white/60 rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-white">
                                <FiftyFiftyIcon className="w-8 h-8"/>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">50:50</h3>
                                <p className="text-sm text-slate-500">Eliminate two wrong answers.</p>
                            </div>
                        </div>
                        {/* Point Doubler Lifeline */}
                        <div className="flex items-center gap-4 p-3 bg-white/60 rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gl-orange-500 flex items-center justify-center text-white">
                                <PointDoublerIcon className="w-8 h-8"/>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Point Doubler</h3>
                                <p className="text-sm text-slate-500">Earned for 2 correct answers in a row.</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        );
    }
    
    const clanColors = {
        header: {
            [Clan.TITANS]: 'bg-red-100 text-red-800',
            [Clan.DEFENDERS]: 'bg-blue-100 text-blue-800',
        },
        border: {
            [Clan.TITANS]: 'border-red-500',
            [Clan.DEFENDERS]: 'border-blue-500',
        }
    };

    const PlayerDesk: React.FC<{ player: Player; isSelf: boolean }> = ({ player, isSelf }) => (
        <div className="flex flex-col items-center animate-pop-in">
            <img src={player.avatar} alt={player.name} className={`w-14 h-14 rounded-full bg-slate-200 ring-4 ring-white ${isSelf ? 'ring-offset-2 ring-offset-gl-orange-500' : ''}`} />
            <p className="mt-1 text-xs text-center font-semibold bg-white/70 px-2 py-0.5 rounded-full truncate w-20">{player.name}</p>
        </div>
    );
    
    const clanName = quiz?.config?.clanNames?.[currentPlayer?.clan as Clan] || currentPlayer?.clan;

    return (
        <div className="flex-grow flex flex-col items-center p-4 text-center animate-fade-in justify-center">
            <h1 className="text-4xl font-bold">You've joined the <span className="font-extrabold">{clanName}</span>!</h1>
            <p className="text-slate-600 text-xl mt-2 mb-4">See your clan on the host's screen. Get ready to play...</p>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {Object.values(Clan).map(clan => {
                    const clanPlayers = allPlayers.filter(p => p.clan === clan);
                    const isPlayerInThisClan = currentPlayer?.clan === clan;
                    const displayClanName = quiz?.config.clanNames?.[clan] || clan;

                    return (
                        <div key={clan} className={`border-2 rounded-2xl p-4 shadow-lg bg-slate-50/50 ${isPlayerInThisClan ? clanColors.border[clan] : 'border-slate-200'}`}>
                            <h2 className={`text-xl font-bold mb-4 p-2 rounded-lg ${clanColors.header[clan]}`}>{displayClanName} ({clanPlayers.length})</h2>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-4 gap-x-2 min-h-[100px]">
                                {clanPlayers.map(p => (
                                    <PlayerDesk key={p.id} player={p} isSelf={p.id === playerId} />
                                ))}
                                {clanPlayers.length === 0 && <p className="col-span-full text-slate-400 self-center">Waiting for players...</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
    
            <div className="max-w-lg mx-auto p-4 bg-gl-orange-50 text-gl-orange-800 rounded-lg flex items-center space-x-3" role="alert">
                <svg className="fill-current h-6 w-6 text-gl-orange-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 20C4.477 20 0 15.523 0 10S4.477 0 10 0s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V5h-2z"/></svg>
                <p className="text-sm font-medium text-left">A stable internet connection is recommended for a smooth experience.</p>
            </div>
        </div>
    );
};

export default PlayerLobby;
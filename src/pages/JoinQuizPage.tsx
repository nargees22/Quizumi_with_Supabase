
import React, { useState, useMemo } from 'react';
// Fix: Ensure useParams, useLocation, and useNavigate are correctly imported from react-router-dom
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../firebase.ts';
import type { Player, QuizConfig, Quiz } from '../../types.ts';
import { Clan } from '../../types.ts';
import { AVATARS } from '../../avatars.ts';
import Card from '../components/Card.tsx';
import Button from '../components/Button.tsx';


const JoinQuizPage = () => {
    const { quizId: paramQuizId } = useParams<{ quizId: string }>();
    const location = useLocation();

    const quizIdFromUrl = useMemo(() => {
        const queryParams = new URLSearchParams(location.search);
        const quizCodeFromQuery = queryParams.get('quizCode');
        return quizCodeFromQuery || paramQuizId;
    }, [location.search, paramQuizId]);

    const [quizId, setQuizId] = useState(quizIdFromUrl || '');
    const [name, setName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const navigate = useNavigate();

    const [step, setStep] = useState<'join' | 'clan'>('join');
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!quizId.trim() || !name.trim() || !selectedAvatar) {
            setError("Quiz code, nickname, and an avatar are required.");
            return;
        }

        setIsJoining(true);
        const upperQuizId = quizId.toUpperCase().trim();
        try {
            const quizRef = db.collection('quizzes').doc(upperQuizId);
            const docSnap = await quizRef.get();
            if (!docSnap.exists) {
                setError("Quiz not found. Please check the code.");
                setIsJoining(false);
                return;
            }
            const quizData = docSnap.data() as Quiz;
            setQuizConfig(quizData.config);

            if (quizData.config.clanBased) {
                const playersSnap = await db.collection('quizzes').doc(upperQuizId).collection('players').get();
                const allPlayersData = playersSnap.docs.map(doc => doc.data() as Player);
                setAllPlayers(allPlayersData);
                
                if (quizData.config.clanAssignment === 'autoBalance') {
                    const clanCounts = allPlayersData.reduce((acc, p) => {
                        if (p.clan) {
                            acc[p.clan] = (acc[p.clan] || 0) + 1;
                        }
                        return acc;
                    }, {} as Record<Clan, number>);
                    
                    const titansCount = clanCounts[Clan.TITANS] || 0;
                    const defendersCount = clanCounts[Clan.DEFENDERS] || 0;

                    const assignedClan = titansCount <= defendersCount ? Clan.TITANS : Clan.DEFENDERS;
                    await handleClanSelectionAndJoin(assignedClan);
                    return;
                }


                setStep('clan');
                setIsJoining(false); // Ready for next user action
            } else {
                // Not clan-based, join directly
                const playerId = crypto.randomUUID();
                const player: Player = { 
                    id: playerId, 
                    name: name.trim(), 
                    score: 0, 
                    answers: [], 
                    avatar: selectedAvatar,
                    lifelines: { pointDoubler: 0 },
                    correctStreak: 0,
                    fiftyFiftyUses: 0,
                };

                const playerRef = db.collection('quizzes').doc(upperQuizId).collection('players').doc(playerId);
                await playerRef.set(player);

                localStorage.setItem(`quiz-player-${upperQuizId}`, playerId);
                navigate(`/player-lobby/${upperQuizId}`);
            }
        } catch (err) {
            console.error("Error verifying quiz code:", err);
            setError("Could not verify quiz. Please try again.");
            setIsJoining(false);
        }
    };

    const handleClanSelectionAndJoin = async (clan: Clan) => {
        if (!quizId || !name || !selectedAvatar) {
            setError("An unexpected error occurred. Please try again.");
            setStep('join');
            return;
        }
        setIsJoining(true);
        const upperQuizId = quizId.toUpperCase().trim();
        try {
            const playerId = crypto.randomUUID();
            const player: Player = { 
                id: playerId, 
                name: name.trim(), 
                score: 0, 
                answers: [], 
                avatar: selectedAvatar, 
                clan,
                lifelines: { pointDoubler: 0 },
                correctStreak: 0,
                fiftyFiftyUses: 0,
            };

            const playerRef = db.collection('quizzes').doc(upperQuizId).collection('players').doc(playerId);
            await playerRef.set(player);

            localStorage.setItem(`quiz-player-${upperQuizId}`, playerId);
            navigate(`/player-lobby/${upperQuizId}`);

        } catch (err) {
            console.error("Failed to join quiz:", err);
            setError("Could not join quiz. Please try again.");
            setIsJoining(false);
            setStep('join'); // Revert to form on error
        }
    };

    const ClanSelection = () => {
        const clanColors: Record<Clan, string> = {
            [Clan.TITANS]: 'from-red-500 to-orange-500',
            [Clan.DEFENDERS]: 'from-blue-500 to-cyan-500',
        };
        const clanNames = quizConfig?.clanNames || { [Clan.TITANS]: 'Titans', [Clan.DEFENDERS]: 'Defenders' };

        const clanPlayerCounts = Object.values(Clan).reduce((acc, clanName) => {
            acc[clanName] = allPlayers.filter(p => p.clan === clanName).length;
            return acc;
        }, {} as Record<Clan, number>);

        return (
            <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-center mb-4">Choose Your Clan</h2>
                {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.values(Clan).map(clan => (
                        <button key={clan} onClick={() => handleClanSelectionAndJoin(clan)}
                            disabled={isJoining}
                            className={`p-6 rounded-lg text-white font-bold text-xl transition transform hover:scale-105 shadow-lg flex flex-col items-center justify-center bg-gradient-to-br ${clanColors[clan]} disabled:opacity-70`}>
                            <span>{clanNames[clan]}</span>
                            <span className="text-sm font-normal mt-1 opacity-90">({clanPlayerCounts[clan]} players)</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
         <div className="flex-grow flex flex-col items-center justify-center p-4 animate-fade-in">
             <Card className="w-full max-w-md">
                 {step === 'join' && (
                     <form onSubmit={handleJoin} className="space-y-4">
                        <h1 className="text-3xl font-bold text-center mb-6">Join a Quiz</h1>
                         <input
                             type="text"
                             value={quizId}
                             onChange={(e) => setQuizId(e.target.value.toUpperCase())}
                             className="w-full text-center tracking-widest text-2xl bg-slate-100 border border-slate-300 rounded-md p-3 focus:ring-2 focus:ring-gl-orange-500 focus:outline-none"
                             placeholder="QUIZ CODE"
                             disabled={!!quizIdFromUrl}
                             aria-label="Quiz Code"
                         />
                          <input
                             type="text"
                             value={name}
                             onChange={(e) => setName(e.target.value)}
                             className="w-full bg-slate-100 border border-slate-300 rounded-md p-3 focus:ring-2 focus:ring-gl-orange-500 focus:outline-none"
                             placeholder="Your Nickname"
                             aria-label="Your Nickname"
                         />
                        <div>
                            <p className="text-center text-slate-600 mb-3">Choose your avatar</p>
                            <div className="grid grid-cols-6 gap-3">
                                {AVATARS.map((avatarSrc, index) => (
                                    <button
                                        type="button"
                                        key={index}
                                        onClick={() => setSelectedAvatar(avatarSrc)}
                                        className={`w-14 h-14 rounded-full cursor-pointer transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-gl-orange-500/50 ${selectedAvatar === avatarSrc ? 'ring-4 ring-gl-orange-500' : 'ring-2 ring-slate-300'}`}
                                        aria-label={`Select avatar ${index + 1}`}
                                    >
                                      <img
                                          src={avatarSrc}
                                          alt={`avatar ${index + 1}`}
                                          className="w-full h-full rounded-full"
                                      />
                                    </button>
                                ))}
                            </div>
                        </div>

                         {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                         <Button type="submit" className="bg-gl-orange-600 hover:bg-gl-orange-700" disabled={isJoining}>
                             {isJoining ? 'Joining...' : 'Join Game'}
                        </Button>
                     </form>
                 )}
                 {step === 'clan' && <ClanSelection />}
             </Card>
         </div>
    );
};

export default JoinQuizPage;

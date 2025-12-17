import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import firebase from '../../firebase';
import type { Quiz, Player, PlayerAnswer } from '../../types';
import { GameState, QuestionType } from '../../types';
import { PageLoader } from '../components/PageLoader';
import { PersistentQRCode } from '../components/PersistentQRCode';
import { TimerCircle } from '../components/TimerCircle';
import Button from '../components/Button';
import { SurveyResultsChart } from '../components/SurveyResultsChart';
import { IntermediateLeaderboard } from '../components/IntermediateLeaderboard';
import { ClanBattleIntro } from '../components/ClanBattleIntro';
import { ClanBattleVsAnimation } from '../components/ClanBattleVsAnimation';
import { CheckIcon } from '../icons/CheckIcon';
import { PointDoublerIcon } from '../icons/PointDoublerIcon';

const QuizHostPage = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    
    const hostId = quizId ? localStorage.getItem(`quiz-host-${quizId}`) : null;
    const isHost = hostId === quiz?.hostId;
    
    // A helper function for consistent word cloud styling
    const getWordStyle = (word: string, index: number) => {
        let hash = 0;
        for (let i = 0; i < word.length; i++) {
            hash = word.charCodeAt(i) + ((hash << 5) - hash);
        }
        hash = hash + index; // Add index to differentiate identical words

        const rotation = (hash % 20) - 10; // -10 to 10 deg
        const fontSize = 1.2 + Math.abs(hash % 100) / 100; // 1.2rem to 2.2rem

        return {
            transform: `rotate(${rotation}deg)`,
            fontSize: `${fontSize}rem`,
            animationDelay: `${index * 50}ms`
        };
    };

    // Automatic game state transitions for timers
    useEffect(() => {
        if (!quiz || !quizId || !isHost) return;

        if (quiz.gameState === GameState.CLAN_BATTLE_VS) {
             const timer = setTimeout(() => {
                db.collection('quizzes').doc(quizId).update({ 
                    gameState: GameState.CLAN_BATTLE_INTRO,
                });
            }, 2000); // 2 second animation
            return () => clearTimeout(timer);
        }

        if (quiz.gameState === GameState.CLAN_BATTLE_INTRO) {
             const timer = setTimeout(() => {
                db.collection('quizzes').doc(quizId).update({ 
                    gameState: GameState.QUESTION_INTRO,
                });
            }, 6000); // 6 second battle intro
            return () => clearTimeout(timer);
        }
        
        if (quiz.gameState === GameState.QUESTION_INTRO) {
            const timer = setTimeout(() => {
                db.collection('quizzes').doc(quizId).update({ 
                    gameState: GameState.QUESTION_ACTIVE, 
                    questionStartTime: Date.now() 
                });
            }, 5000); // 5 second intro
            return () => clearTimeout(timer);
        }
        
        if (quiz.gameState === GameState.FINISHED) {
            navigate(`/leaderboard/${quizId}`);
        }
    }, [quiz?.gameState, quizId, navigate, isHost, quiz]);

    // Data subscriptions
    useEffect(() => {
        if (!quizId) return;
        const unsubQuiz = db.collection('quizzes').doc(quizId).onSnapshot((docSnap) => setQuiz(docSnap.data() as Quiz));
        const unsubPlayers = db.collection('quizzes').doc(quizId).collection('players').onSnapshot((snap) => {
            const playersData = snap.docs.map(d => d.data() as Player);
            setPlayers(playersData);
        });
        return () => { unsubQuiz(); unsubPlayers(); };
    }, [quizId]);

    // Host controls
    const handleShowResult = async () => {
        if (!quizId || !quiz) return;
    
        // Scoring is now calculated on the player's device when they answer.
        // This function simply advances the game state for all players.
        await db.collection('quizzes').doc(quizId).update({ 
            gameState: GameState.QUESTION_RESULT, 
            questionStartTime: null 
        });
    };

    const handleShowLeaderboard = async () => {
        if (!quizId || !quiz) return;
        const isLastQuestion = quiz.currentQuestionIndex === quiz.questions.length - 1;
        
        const updateData: { gameState: GameState; endTime?: any; participantCount?: number } = {
            gameState: isLastQuestion ? GameState.FINISHED : GameState.LEADERBOARD
        };

        if (isLastQuestion) {
            updateData.endTime = firebase.firestore.FieldValue.serverTimestamp();
            updateData.participantCount = players.length;
        }

        await db.collection('quizzes').doc(quizId).update(updateData);
    };

    const handleNextQuestion = async () => {
        if (!quizId || !quiz) return;
        if (quiz.currentQuestionIndex < quiz.questions.length - 1) {
            await db.collection('quizzes').doc(quizId).update({ 
                gameState: GameState.QUESTION_INTRO, 
                currentQuestionIndex: quiz.currentQuestionIndex + 1 
            });
        } else {
             // If it's the last question, show final leaderboard instead
            await handleShowLeaderboard();
        }
    };

    if (!quiz) return <PageLoader message="Loading quiz..." />;

    const currentQuestion = quiz.questions[quiz.currentQuestionIndex];
    
    const shouldShowHostControls = isHost && [
        GameState.QUESTION_ACTIVE, 
        GameState.QUESTION_RESULT, 
        GameState.LEADERBOARD
    ].includes(quiz.gameState);

    const question = quiz.questions[quiz.currentQuestionIndex];
    const answersForCurrentQuestion = players.map(p => p.answers.find(a => a.questionId === question.id)).filter(Boolean) as PlayerAnswer[];
    
    const getAnswerCounts = () => {
        if (question.type === QuestionType.MCQ || question.type === QuestionType.SURVEY) {
             return question.options.map((_, index) => answersForCurrentQuestion.filter(a => a.answer === index).length);
        }
        return [];
    };
    const answerCounts = getAnswerCounts();
    const totalAnswers = answersForCurrentQuestion.length;
    
    const renderContent = () => {
        switch (quiz.gameState) {
            case GameState.CLAN_BATTLE_VS:
                return <ClanBattleVsAnimation quiz={quiz} />;
            case GameState.CLAN_BATTLE_INTRO:
                return <ClanBattleIntro quiz={quiz} players={players} />;
            case GameState.QUESTION_INTRO:
                return (
                    <div className="text-center animate-fade-in">
                        <p className="text-xl text-slate-500">Question {quiz.currentQuestionIndex + 1}</p>
                        <h1 className="text-5xl font-bold my-8">{question.text}</h1>
                    </div>
                );
            case GameState.QUESTION_ACTIVE: {
                const colors = ['bg-red-500', 'bg-gl-orange-500', 'bg-yellow-400', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];
                const shouldShowOptions = (question.type === QuestionType.MCQ || question.type === QuestionType.SURVEY) && question.options;
                const shouldShowLiveCount = quiz?.config?.showLiveResponseCount;

                const getLifelineCounts = () => {
                    if (question.type === QuestionType.MCQ) {
                         return question.options.map((_, index) => {
                            const doublerCount = answersForCurrentQuestion.filter(a => a.answer === index && a.lifelineUsed === 'pointDoubler').length;
                            return { doublerCount };
                         });
                    }
                    return [];
                };
                const lifelineCounts = getLifelineCounts();
            
                let questionBody: React.ReactNode;
            
                if (question.type === QuestionType.WORD_CLOUD) {
                    const wordCloudAnswers = players
                        .map(p => p.answers.find(a => a.questionId === question.id)?.answer)
                        .filter(a => typeof a === 'string' && a.trim() !== '') as string[];
                    
                    questionBody = (
                         <div className="p-8 flex-grow">
                            <div className="w-full flex flex-wrap justify-center items-center gap-4 min-h-[300px]">
                                {wordCloudAnswers.length === 0 ? (
                                    <p className="text-slate-500 text-lg">Waiting for responses...</p>
                                ) : (
                                    wordCloudAnswers.map((answer, i) => (
                                        <span
                                            key={`${answer}-${i}`}
                                            className="bg-slate-100 text-slate-800 font-semibold py-2 px-4 rounded-lg shadow-md animate-pop-in"
                                            style={getWordStyle(answer, i)}
                                        >
                                            {answer}
                                        </span>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                } else if (shouldShowOptions) { // MCQ and SURVEY
                     questionBody = (
                        <div className="p-8 flex-grow">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                                {question.options.map((opt, i) => {
                                     if (shouldShowLiveCount) {
                                        const maxCount = Math.max(...answerCounts, 1);
                                        const count = answerCounts[i] || 0;
                                        const doublerCount = lifelineCounts[i]?.doublerCount || 0;
                                        const percentage = (count / maxCount) * 100;
                                        return (
                                            <div key={i} className={`rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-md relative overflow-hidden min-h-[100px] ${colors[i % colors.length]}`}>
                                                <div className="absolute left-0 top-0 bottom-0 bg-black/20" style={{width: `${percentage}%`, transition: 'width 0.3s ease-in-out'}}></div>
                                                <div className="z-10 flex items-center justify-between w-full p-6 gap-4">
                                                    <span className="break-words text-left flex-grow">{opt}</span>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {doublerCount > 0 && (
                                                            <div className="flex items-center gap-1 bg-yellow-400/80 rounded-full px-2 py-0.5 text-xs font-bold text-yellow-900 animate-pop-in" title={`${doublerCount} players used Point Doubler`}>
                                                                <PointDoublerIcon className="w-4 h-4" />
                                                                <span>{doublerCount}</span>
                                                            </div>
                                                        )}
                                                        <span className="font-bold bg-black/30 rounded-full px-4 py-1 text-lg">{count}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={i} className={`p-6 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-md min-h-[100px] ${colors[i % colors.length]}`}>
                                            <span className="text-center break-words">{opt}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                } else { // MATCH or others
                    questionBody = (
                        <div className="p-8 flex-grow min-h-[200px] flex items-center justify-center">
                            <p className="text-slate-500 text-2xl">Players are responding on their devices.</p>
                        </div>
                    );
                }
            
                return (
                    <div className="flex flex-col items-center animate-fade-in w-full max-w-4xl px-4">
                        <div className="flex justify-between items-center w-full mb-6">
                            <div className="bg-white/80 backdrop-blur-sm shadow-lg rounded-full px-6 py-3 text-2xl font-bold text-slate-800">
                                <span>{totalAnswers} / {players.length} Answered</span>
                            </div>
                            <TimerCircle key={`${question.id}-active`} duration={question.timeLimit} start={true} />
                        </div>
            
                        <div className="w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-pop-in">
                            <div className="bg-slate-800 p-8">
                                <h1 className="text-3xl font-bold text-white text-center">{question.text}</h1>
                            </div>
                            {questionBody}
                        </div>
                    </div>
                );
            }
            case GameState.QUESTION_RESULT:
                if (question.type === QuestionType.WORD_CLOUD) {
                    const wordCloudAnswers = players
                        .map(p => p.answers.find(a => a.questionId === question.id)?.answer)
                        .filter(a => typeof a === 'string' && a.trim() !== '') as string[];

                    return (
                        <div className="flex flex-col items-center animate-fade-in w-full max-w-4xl">
                            <h1 className="text-3xl font-bold my-6 text-center">{question.text}</h1>
                            <div className="w-full p-4 flex flex-wrap justify-center items-center gap-4 bg-slate-100 rounded-lg min-h-[400px]">
                                {wordCloudAnswers.length === 0 ? (
                                    <p className="text-slate-500">No responses were submitted.</p>
                                ) : (
                                    wordCloudAnswers.map((answer, i) => (
                                        <span 
                                            key={`${answer}-${i}`}
                                            className="bg-white text-slate-800 font-semibold py-2 px-4 rounded-lg shadow-md animate-pop-in"
                                            style={getWordStyle(answer, i)}
                                        >
                                            {answer}
                                        </span>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                }
                if (question.type === QuestionType.MATCH && question.matchPairs) {
                    const allPlayerAnswers = players.map(p => p.answers.find(a => a.questionId === question.id)).filter(a => a && Array.isArray(a.answer)) as PlayerAnswer[];
                    const pairCorrectCounts = question.matchPairs.map((pair, promptIndex) => {
                        let correctCount = 0;
                        allPlayerAnswers.forEach(ans => {
                            const playerAnswerArr = ans.answer as number[];
                            if (playerAnswerArr[promptIndex] !== null && playerAnswerArr[promptIndex] !== undefined) {
                                const chosenOptionText = question.options[playerAnswerArr[promptIndex]];
                                if (chosenOptionText === pair.correctMatch) {
                                    correctCount++;
                                }
                            }
                        });
                        return correctCount;
                    });
                    const totalPlayersAnswered = allPlayerAnswers.length;

                    return (
                        <div className="flex flex-col items-center animate-fade-in w-full max-w-3xl">
                           <h1 className="text-3xl font-bold my-6 text-center">{question.text}</h1>
                           <div className="w-full space-y-3">
                               {question.matchPairs.map((pair, i) => {
                                   const percentage = totalPlayersAnswered > 0 ? (pairCorrectCounts[i] / totalPlayersAnswered) * 100 : 0;
                                   return (
                                    <div key={i} className="p-4 rounded-lg bg-white border-2 border-green-500 grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2">
                                        {/* Row 1 */}
                                        <p className="font-semibold text-lg text-slate-700 text-left">{pair.prompt}</p>
                                        <p className="font-semibold text-lg text-slate-900 text-right">{pair.correctMatch}</p>
            
                                        {/* Row 2 */}
                                        <div className="bg-slate-200 rounded-full h-4">
                                            <div className="bg-green-500 h-4 rounded-full" style={{width: `${percentage}%`, transition: 'width 0.5s ease-in-out'}}></div>
                                        </div>
                                        <p className="font-bold text-slate-600 text-sm text-right">{percentage.toFixed(0)}%</p>
                                    </div>
                                   );
                               })}
                           </div>
                       </div>
                   );
                }
                if (question.type === QuestionType.SURVEY) {
                     return (
                        <div className="flex flex-col items-center animate-fade-in w-full">
                             <h1 className="text-3xl font-bold my-6 text-center">{question.text}</h1>
                             <SurveyResultsChart options={question.options} answerCounts={answerCounts} />
                        </div>
                    );
                }
                 if (question.type === QuestionType.MCQ) {
                    const maxCount = Math.max(...answerCounts, 1);
                    return (
                         <div className="flex flex-col items-center animate-fade-in">
                            <h1 className="text-3xl font-bold my-6 text-center">{question.text}</h1>
                            <div className="w-full max-w-2xl mx-auto space-y-3">
                                {question.options.map((opt, i) => (
                                    <div key={i} className={`p-4 rounded-lg flex items-center justify-between text-lg font-semibold relative overflow-hidden bg-white ${i === question.correctAnswerIndex ? 'border-2 border-green-500' : 'border border-slate-200'}`}>
                                        <div className="absolute left-0 top-0 bottom-0 bg-gl-orange-500/20" style={{width: `${(answerCounts[i] / maxCount) * 100}%`}}></div>
                                        <span className="z-10">{opt}</span>
                                        <span className="z-10 flex items-center space-x-2">
                                            {i === question.correctAnswerIndex && <CheckIcon className="text-green-500"/>}
                                            <span className="font-bold">{answerCounts[i]}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                }
                return <div>Unsupported question type for results.</div>;
            case GameState.LEADERBOARD:
                return (
                    <div className="w-full max-w-4xl max-h-[calc(100vh-250px)] overflow-y-auto p-2 sm:p-4 custom-scrollbar rounded-lg bg-white/50">
                        <IntermediateLeaderboard
                            players={players}
                            quiz={quiz}
                            animate={false}
                        />
                    </div>
                );
            default:
                return <div>Loading...</div>;
        }
    };

    return (
        <div className="h-full flex flex-col items-center p-4">
             {quizId && <PersistentQRCode quizId={quizId} />}
             <div className="flex-grow w-full overflow-y-auto custom-scrollbar py-4">
                <div className="w-full flex justify-center">
                    {renderContent()}
                </div>
            </div>
            {shouldShowHostControls && (
                <div className="w-full max-w-md p-4 sticky bottom-0 bg-slate-50/80 backdrop-blur-sm">
                    {quiz.gameState === GameState.QUESTION_ACTIVE && (
                        <Button onClick={handleShowResult} className="bg-gl-orange-600 hover:bg-gl-orange-700">Show Results</Button>
                    )}
                    {quiz.gameState === GameState.QUESTION_RESULT && (
                         (quiz.currentQuestionIndex === quiz.questions.length - 1) ?
                            <Button onClick={handleShowLeaderboard} className="bg-gl-orange-600 hover:bg-gl-orange-700">Show Final Leaderboard</Button>
                         : (question.type === QuestionType.SURVEY || question.type === QuestionType.WORD_CLOUD) ?
                            <Button onClick={handleNextQuestion} className="bg-gl-orange-600 hover:bg-gl-orange-700">Next Question</Button>
                         :
                            <Button onClick={handleShowLeaderboard} className="bg-gl-orange-600 hover:bg-gl-orange-700">Show Leaderboard</Button>
                    )}
                    {quiz.gameState === GameState.LEADERBOARD && (
                         <Button onClick={handleNextQuestion} className="bg-gl-orange-600 hover:bg-gl-orange-700">Next Question</Button>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuizHostPage;
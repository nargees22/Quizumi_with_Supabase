
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// Fix: Ensure useParams and useNavigate are correctly imported from react-router-dom
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
// FIX: import firebase to use FieldValue for database operations.
import firebase from '../../firebase';
import type { Quiz, Player, PlayerAnswer, Question } from '../../types';
import { GameState, QuestionType } from '../../types';
import { PageLoader } from '../components/PageLoader';
import { IntermediateLeaderboard } from '../components/IntermediateLeaderboard';
import { ClanBattleIntro } from '../components/ClanBattleIntro';
import { ClanBattleVsAnimation } from '../components/ClanBattleVsAnimation';
import { playSound } from '../utils/audio';
import { getUniqueMessage, getUniqueTip } from '../utils/messages';
import { PlayerQuestionActive } from '../components/PlayerQuestionActive';
import { PlayerQuestionResult } from '../components/PlayerQuestionResult';

const QuizPlayerPage = () => {
    const { quizId, playerId } = useParams<{ quizId: string; playerId: string }>();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [player, setPlayer] = useState<Player | null>(null);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [submittedAnswer, setSubmittedAnswer] = useState<PlayerAnswer['answer'] | null>(null);
    const [soundPlayed, setSoundPlayed] = useState(false);
    const localQuestionStartTimeRef = useRef<number | null>(null);
    const [currentResultMessage, setCurrentResultMessage] = useState('');
    const [strategicTip, setStrategicTip] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // State for Lifelines
    const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
    const [isUsingLifeline, setIsUsingLifeline] = useState(false);
    const [lifelineUsedThisTurn, setLifelineUsedThisTurn] = useState<'fiftyFifty' | 'pointDoubler' | null>(null);
    const [confirmingLifeline, setConfirmingLifeline] = useState<'fiftyFifty' | 'pointDoubler' | null>(null);
    const [lifelineEarned, setLifelineEarned] = useState<'pointDoubler' | null>(null);
    const [isAnswerLocked, setIsAnswerLocked] = useState(false);

    const question = quiz?.questions[quiz.currentQuestionIndex];
    const lastAnswer = player?.answers.find(a => a.questionId === question?.id);
    const playerHasAnswered = !!lastAnswer;

    const isCorrect = useMemo(() => {
        if (!lastAnswer || !question || question.type !== QuestionType.MCQ) return false;
        return lastAnswer.answer === question.correctAnswerIndex;
    }, [lastAnswer, question]);
    
    const correctMatchesCount = useMemo(() => {
        if (!lastAnswer || !question || question.type !== QuestionType.MATCH || !question.matchPairs || !Array.isArray(lastAnswer.answer)) return 0;
        let count = 0;
        (lastAnswer.answer as number[]).forEach((originalOptionIndex, promptIndex) => {
            if (originalOptionIndex !== null && typeof originalOptionIndex !== 'undefined') {
                const chosenOptionText = question.options[originalOptionIndex];
                const correctOptionText = question.matchPairs?.[promptIndex]?.correctMatch;
                if (chosenOptionText === correctOptionText) {
                    count++;
                }
            }
        });
        return count;
    }, [lastAnswer, question]);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const backgroundClass = useMemo(() => {
        if (!quiz) return 'bg-[#f2f3f6]';
        if ([GameState.QUESTION_INTRO, GameState.QUESTION_ACTIVE, GameState.LEADERBOARD].includes(quiz.gameState)) {
            return 'bg-[#f2f3f6]';
        }
        if (quiz.gameState === GameState.CLAN_BATTLE_VS) {
            return 'bg-clan-battle-bg';
        }
        return 'bg-slate-100';
    }, [quiz?.gameState]);

    const textColorClass = useMemo(() => {
        if (!quiz) return 'text-slate-800';
        if ([GameState.QUESTION_INTRO, GameState.QUESTION_ACTIVE, GameState.LEADERBOARD].includes(quiz.gameState)) {
            return 'text-slate-800';
        }
        return 'text-white';
    }, [quiz?.gameState]);

    useEffect(() => {
        if (!quizId || !playerId) {
            navigate('/join');
            return;
        }
        
        const unsubQuiz = db.collection('quizzes').doc(quizId).onSnapshot((docSnap) => {
            const quizData = docSnap.data() as Quiz;
            if (quizData) {
                if (quizData.gameState === GameState.FINISHED) {
                    navigate(`/leaderboard/${quizId}`);
                    return;
                }
                
                const questionJustStarted = quiz?.currentQuestionIndex !== quizData.currentQuestionIndex || quiz?.gameState !== quizData.gameState;

                if ((quizData.gameState === GameState.QUESTION_INTRO || quizData.gameState === GameState.CLAN_BATTLE_INTRO || quizData.gameState === GameState.CLAN_BATTLE_VS) && questionJustStarted) {
                    setSubmittedAnswer(null);
                    setSoundPlayed(false);
                    localQuestionStartTimeRef.current = null;
                    setCurrentResultMessage('');
                    setEliminatedOptions([]);
                    setLifelineUsedThisTurn(null);
                    setLifelineEarned(null);
                    setIsAnswerLocked(false);
                    setStrategicTip(getUniqueTip());
                }

                if (quizData.gameState === GameState.QUESTION_ACTIVE && localQuestionStartTimeRef.current === null) {
                    localQuestionStartTimeRef.current = Date.now();
                }
                setQuiz(quizData);
            }
        });

        const unsubPlayer = db.collection('quizzes').doc(quizId).collection('players').doc(playerId).onSnapshot((docSnap) => {
            setPlayer(docSnap.data() as Player);
        });

        const unsubAllPlayers = db.collection('quizzes').doc(quizId).collection('players').onSnapshot((snap) => {
            setAllPlayers(snap.docs.map(d => d.data() as Player));
        });

        return () => { unsubQuiz(); unsubPlayer(); unsubAllPlayers(); };
    }, [quizId, playerId, navigate, quiz?.currentQuestionIndex, quiz?.gameState]);

    useEffect(() => {
        if (playerHasAnswered && question && !currentResultMessage) {
            let message = '';
            if (question.type === QuestionType.SURVEY || question.type === QuestionType.WORD_CLOUD) {
                message = "Thanks for your submission!";
            } else if (question.type === QuestionType.MATCH) {
                const totalPairs = question.matchPairs?.length || 0;
                message = `You matched ${correctMatchesCount} out of ${totalPairs} correctly!`;
            } else { // MCQ
                message = getUniqueMessage(isCorrect);
            }
            setCurrentResultMessage(message);
        }
    }, [lastAnswer, question, isCorrect, correctMatchesCount, currentResultMessage, playerHasAnswered]);

    useEffect(() => {
        if (playerHasAnswered && !soundPlayed) {
            if (question?.type === QuestionType.SURVEY || question?.type === QuestionType.WORD_CLOUD) {
                // Sound already played on submission
            } else if (question?.type === QuestionType.MATCH) {
                // Sound already played on submission
            } else {
                playSound(isCorrect ? 'correct' : 'wrong');
            }
            setSoundPlayed(true);
        }
    }, [playerHasAnswered, soundPlayed, question, isCorrect]);
    
    const fiftyFiftyCost = useMemo(() => {
        if (!player) return Infinity;
        // Cost starts at 200, then 400, 800, etc.
        return 200 * (2 ** (player.fiftyFiftyUses || 0));
    }, [player]);

    const submitAnswer = useCallback(async (answerPayload: PlayerAnswer['answer']) => {
        if (isAnswerLocked || playerHasAnswered || !localQuestionStartTimeRef.current || !quizId || !playerId || !question || !player) return;

        // Optimistic UI update
        setIsAnswerLocked(true);
        setSubmittedAnswer(answerPayload);
        playSound('survey'); // Play a neutral sound on submission

        const timeTaken = (Date.now() - localQuestionStartTimeRef.current) / 1000;
        let score = 0;
        
        const isPointDoublerActive = lifelineUsedThisTurn === 'pointDoubler';
        let isAnswerCorrectForStreak = false;
        
        if (question.type === QuestionType.MCQ) {
            const isAnswerCorrect = answerPayload === question.correctAnswerIndex;
            isAnswerCorrectForStreak = isAnswerCorrect;
            if (isAnswerCorrect) {
                const baseScore = 1000;
                const timeBonus = Math.round(Math.max(0, (1 - (timeTaken / question.timeLimit))) * 1000);
                score = baseScore + timeBonus;
                if (isPointDoublerActive) {
                    score *= 2;
                }
            }
        } else if (question.type === QuestionType.MATCH && Array.isArray(answerPayload) && question.matchPairs && question.options) {
             let correctCount = 0;
             answerPayload.forEach((originalOptionIndex, promptIndex) => {
                if (originalOptionIndex !== null && typeof originalOptionIndex !== 'undefined') {
                    const chosenOptionText = question.options[originalOptionIndex];
                    const correctOptionText = question.matchPairs![promptIndex].correctMatch;
                    if (chosenOptionText === correctOptionText) {
                        correctCount++;
                    }
                }
            });
            if (correctCount > 0) {
                const baseScore = 2000;
                const timeBonus = Math.round(Math.max(0, (1 - (timeTaken / question.timeLimit))) * 1000);
                score = Math.round((correctCount / question.matchPairs.length) * (baseScore + timeBonus));
            }
        }
        
        const answer: PlayerAnswer = { questionId: question.id, answer: answerPayload, timeTaken, score };
        if (lifelineUsedThisTurn) {
            answer.lifelineUsed = lifelineUsedThisTurn;
        }

        const playerRef = db.collection('quizzes').doc(quizId).collection('players').doc(playerId);
        
        try {
            const playerDoc = await playerRef.get();
            if (!playerDoc.exists) throw "Player document not found!";
            const playerData = playerDoc.data() as Player;

            const updates: { [key: string]: any } = {
                answers: firebase.firestore.FieldValue.arrayUnion(answer),
                score: firebase.firestore.FieldValue.increment(score),
            };

            const isLastQuestion = quiz.currentQuestionIndex === quiz.questions.length - 1;

            if (question.type === QuestionType.MCQ) {
                if (isAnswerCorrectForStreak) {
                    const newStreak = (playerData.correctStreak || 0) + 1;
                    updates.correctStreak = newStreak;
                    if (newStreak === 2 && !isLastQuestion) {
                        updates['lifelines.pointDoubler'] = firebase.firestore.FieldValue.increment(1);
                        updates.correctStreak = 0; // Reset streak after earning
                    }
                } else {
                    updates.correctStreak = 0;
                }
            }
            await playerRef.update(updates);

            if (question.type === QuestionType.MCQ && isAnswerCorrectForStreak && !isLastQuestion) {
                const newStreak = (player.correctStreak || 0) + 1;
                if (newStreak === 2) {
                    setLifelineEarned('pointDoubler');
                }
            }
        } catch (error) {
            console.error("Update failed: ", error);
        }

    }, [isAnswerLocked, playerHasAnswered, quizId, playerId, question, player, lifelineUsedThisTurn, quiz]);
    
    const canUseFiftyFifty = useMemo(() => {
        return (
            player &&
            question?.type === QuestionType.MCQ &&
            !playerHasAnswered &&
            quiz?.gameState === GameState.QUESTION_ACTIVE &&
            player.score >= fiftyFiftyCost &&
            !lifelineUsedThisTurn
        );
    }, [player, question, playerHasAnswered, quiz?.gameState, lifelineUsedThisTurn, fiftyFiftyCost]);

    const canUsePointDoubler = useMemo(() => {
        return (
            player &&
            question?.type === QuestionType.MCQ &&
            !playerHasAnswered &&
            quiz?.gameState === GameState.QUESTION_ACTIVE &&
            player.lifelines.pointDoubler > 0 &&
            !lifelineUsedThisTurn
        );
    }, [player, question, playerHasAnswered, quiz?.gameState, lifelineUsedThisTurn]);

    const handleUseLifeline = async (type: 'fiftyFifty' | 'pointDoubler') => {
        if (isUsingLifeline || !quizId || !playerId || !player || !question) return;

        setConfirmingLifeline(null);
        setIsUsingLifeline(true);
        setLifelineUsedThisTurn(type);

        const playerRef = db.collection('quizzes').doc(quizId).collection('players').doc(playerId);

        try {
            const updates: { [key: string]: any } = {};
            if (type === 'fiftyFifty') {
                 updates.score = firebase.firestore.FieldValue.increment(-fiftyFiftyCost);
                 updates.fiftyFiftyUses = firebase.firestore.FieldValue.increment(1);
            } else { // pointDoubler
                 updates['lifelines.pointDoubler'] = firebase.firestore.FieldValue.increment(-1);
            }
            await playerRef.update(updates);

            if (type === 'fiftyFifty') {
                const correctAnswerIndex = question.correctAnswerIndex!;
                const incorrectOptions = question.options
                    .map((_, index) => index)
                    .filter(index => index !== correctAnswerIndex);

                const incorrectToKeepIndex = incorrectOptions[Math.floor(Math.random() * incorrectOptions.length)];
                const optionsToEliminate = incorrectOptions.filter(index => index !== incorrectToKeepIndex);
                setEliminatedOptions(optionsToEliminate);
            }
            playSound('survey');

        } catch (error) {
            console.error("Error using lifeline:", error);
            setLifelineUsedThisTurn(null); // Revert on error
        } finally {
            setIsUsingLifeline(false);
        }
    };

    const handleLifelineClick = (type: 'fiftyFifty' | 'pointDoubler') => {
        // Universal checks first
        if (!player || !question) return;
    
        if (question.type !== QuestionType.MCQ) {
            setToastMessage("Lifelines can only be used on Multiple Choice Questions.");
            return;
        }
        if (quiz?.gameState !== GameState.QUESTION_ACTIVE) {
            setToastMessage("You can only use lifelines while the question is active.");
            return;
        }
        if (playerHasAnswered) {
            setToastMessage("You have already answered this question.");
            return;
        }
        if (lifelineUsedThisTurn) {
            setToastMessage("You can only use one lifeline per question.");
            return;
        }
    
        // Lifeline-specific checks
        if (type === 'fiftyFifty') {
            if (player.score < fiftyFiftyCost) {
                setToastMessage(`You need ${fiftyFiftyCost} points to use this.`);
                return;
            }
            setConfirmingLifeline('fiftyFifty');
        } else { // pointDoubler
            if (player.lifelines.pointDoubler <= 0) {
                setToastMessage("Get a 2-question streak to earn a Point Doubler!");
                return;
            }
            setConfirmingLifeline('pointDoubler');
        }
    };
    
    if (!quiz || !player || !question) return <PageLoader message="Connecting to quiz..." />;
    
    const renderContent = () => {
        // Handle special, full-screen states first
        if (quiz.gameState === GameState.CLAN_BATTLE_VS) {
            return <ClanBattleVsAnimation quiz={quiz} />;
        }
        if (quiz.gameState === GameState.CLAN_BATTLE_INTRO) {
            return <ClanBattleIntro quiz={quiz} players={allPlayers} playerId={playerId} />;
        }
        if (quiz.gameState === GameState.LEADERBOARD) {
            return (
                <div className="flex-grow w-full flex flex-col items-center justify-center p-4 sm:p-8">
                     <IntermediateLeaderboard
                        players={allPlayers}
                        quiz={quiz}
                        highlightPlayerId={playerId}
                        animate={true}
                        strategicTip={strategicTip}
                    />
                </div>
            )
        }
        
        // Handle states after answering a question or when results are shown
        if (quiz.gameState === GameState.QUESTION_RESULT || playerHasAnswered) {
             return (
                <PlayerQuestionResult
                    question={question}
                    isCorrect={isCorrect}
                    correctMatchesCount={correctMatchesCount}
                    currentResultMessage={currentResultMessage}
                    lifelineEarned={lifelineEarned}
                    setLifelineEarned={setLifelineEarned}
                />
             );
        }

        if (isAnswerLocked) {
             return (
                <div className="w-full flex-grow flex flex-col items-center justify-center p-4 animate-fade-in">
                    <h1 className="text-4xl font-bold">Submitted!</h1>
                    <p className="text-slate-600 text-xl mt-2">Waiting for other players...</p>
                </div>
            );
        }

        // Handle QUESTION_INTRO and QUESTION_ACTIVE states together for smooth transition
        if (quiz.gameState === GameState.QUESTION_INTRO || quiz.gameState === GameState.QUESTION_ACTIVE) {
            return (
                <PlayerQuestionActive
                    quiz={quiz}
                    player={player}
                    question={question}
                    allPlayers={allPlayers}
                    submitAnswer={submitAnswer}
                    lifelineUsedThisTurn={lifelineUsedThisTurn}
                    eliminatedOptions={eliminatedOptions}
                    handleLifelineClick={handleLifelineClick}
                    isUsingLifeline={isUsingLifeline}
                    canUseFiftyFifty={canUseFiftyFifty}
                    canUsePointDoubler={canUsePointDoubler}
                    fiftyFiftyCost={fiftyFiftyCost}
                    confirmingLifeline={confirmingLifeline}
                    setConfirmingLifeline={setConfirmingLifeline}
                    handleUseLifeline={handleUseLifeline}
                />
            );
        }

        // Fallback for any unhandled states
        return <PageLoader message="Connecting to quiz..." />;
    };

    return (
        <div className={`flex-grow flex flex-col ${backgroundClass} ${textColorClass}`}>
            {lifelineUsedThisTurn === 'pointDoubler' && !playerHasAnswered && <div className="point-doubler-active-effect" />}
            {toastMessage && (
                <div className="toast-notification bg-slate-800 text-white font-semibold py-3 px-6 rounded-lg shadow-lg">
                    {toastMessage}
                </div>
            )}
            {renderContent()}
        </div>
    );
};

export default QuizPlayerPage;

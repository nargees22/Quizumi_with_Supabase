
import React, { useState, useEffect, useMemo } from 'react';
// Fix: Ensure useNavigate is correctly imported from react-router-dom
import { useNavigate } from 'react-router-dom';
import { supabase } from "../service/supabase.ts";
import { generateQuestions } from '../gemini.ts';
import type { Quiz, Question, QuizConfig, MatchPair } from '../types.ts';
import { GameState, QuestionType, Clan } from '../types.ts';

import Card from '../components/Card.tsx';
import Button from '../components/Button.tsx';
import { PageLoader } from '../components/PageLoader.tsx';
import { CustomSelect } from '../components/CustomSelect.tsx';
import { EditQuestionModal } from '../components/EditQuestionModal.tsx';
import { LoadingSpinner } from '../icons/LoadingSpinner.tsx';
import { WandIcon } from '../icons/WandIcon.tsx';
import { EditIcon } from '../icons/EditIcon.tsx';
import { DeleteIcon } from '../icons/DeleteIcon.tsx';
import { CalendarIcon } from '../icons/CalendarIcon.tsx';
import { UpArrowIcon } from '../icons/UpArrowIcon.tsx';
import { DownArrowIcon } from '../icons/DownArrowIcon.tsx';
import { SearchIcon } from '../icons/SearchIcon.tsx';
import { UsersIcon } from '../icons/UsersIcon.tsx';

const notAvailable = () => {
    alert("This feature is temporarily disabled during Supabase migration.");
};

const countWords = (str: string) => str ? str.trim().split(/\s+/).filter(Boolean).length : 0;

const CreateQuizPage = () => {
    const navigate = useNavigate();
    const organizerName = useMemo(() => sessionStorage.getItem('quiz-organizer'), []);

    const [title, setTitle] = useState('');
    const [dynamicTitle, setDynamicTitle] = useState('');
    const [questions, setQuestions] = useState<Array<Question>>([]);
    const [view, setView] = useState<'past' | 'reports' | 'library' | 'custom' | 'ai'>('past');
    const [isCreating, setIsCreating] = useState(false);
    const [libraryQuestions, setLibraryQuestions] = useState<Question[]>([]);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
    const [libraryView, setLibraryView] = useState<'all' | 'mine'>('all');
    const [technologies, setTechnologies] = useState<string[]>([]);
    const [masterSkills, setMasterSkills] = useState<string[]>([]);
    const [skillsForFilter, setSkillsForFilter] = useState<string[]>([]);
    const [selectedTechnology, setSelectedTechnology] = useState('all');
    const [selectedSkill, setSelectedSkill] = useState('all');
    const [selectedQuestionType, setSelectedQuestionType] = useState('all');
    const [editingLibraryQuestion, setEditingLibraryQuestion] = useState<Question | null>(null);
    const [librarySearchTerm, setLibrarySearchTerm] = useState('');
    const [draftQuizzes, setDraftQuizzes] = useState<Quiz[]>([]);
    const [pastQuizzes, setPastQuizzes] = useState<Quiz[]>([]);
    const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(true);
    const [pastQuizzesSearchTerm, setPastQuizzesSearchTerm] = useState('');
    const [draftsSearchTerm, setDraftsSearchTerm] = useState('');
    const [reportSearchTerm, setReportSearchTerm] = useState('');
    const [expandedReportGroup, setExpandedReportGroup] = useState<string | null>(null);
    const [expandedPastQuizGroup, setExpandedPastQuizGroup] = useState<string | null>(null);
    const [editingDraft, setEditingDraft] = useState<Quiz | null>(null);

    const [quizConfig, setQuizConfig] = useState<QuizConfig>({
        showLiveResponseCount: true,
        showQuestionToPlayers: true,
        clanBased: false,
        clanNames: { [Clan.TITANS]: 'Titans', [Clan.DEFENDERS]: 'Defenders' },
        clanAssignment: 'autoBalance',
    });

    const [agendaInfo, setAgendaInfo] = useState<{ agendaId?: string; agendaName?: string; eventId?: string }>({});

    const [customQuestion, setCustomQuestion] = useState({
        text: '',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
        matchPairs: [{ prompt: '', correctMatch: '' }, { prompt: '', correctMatch: '' }],
        timeLimit: 30,
        technology: '',
        skill: '',
        type: QuestionType.MCQ,
    });

    const [aiTopic, setAiTopic] = useState('');
    const [aiSkill, setAiSkill] = useState('');
    const [aiNumQuestions, setAiNumQuestions] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiUsage, setAiUsage] = useState(0);
    const [isCheckingUsage, setIsCheckingUsage] = useState(true);
    const dailyAiLimit = 15;

    const finalTitle = useMemo(() => {
        if (agendaInfo.agendaName) {
            return dynamicTitle.trim() ? `${agendaInfo.agendaName} - ${dynamicTitle.trim()}` : '';
        }
        return title.trim();
    }, [agendaInfo.agendaName, dynamicTitle, title]);

    useEffect(() => {
        if (!organizerName) {
            navigate('/');
            return;
        }

        const fetchLibraryData = async () => {
            setIsLoadingLibrary(true);
            try {
                const { data, error } = await supabase
                    .from('question_bank_structured')
                    .select('*');

                if (error) {
                    console.error('Error fetching question library:', error);
                    setIsLoadingLibrary(false);
                    return;
                }

                const mappedQuestions: Question[] = (data || []).map((row: any) => ({
                    id: row.pk_id.toString(),
                    text: row.question_text,
                    timeLimit: row.time_limit,
                    technology: row.technology,
                    skill: row.skill,
                    type: row.type,
                    organizerName: row.organizer_name,
                    options: [row.option_1, row.option_2, row.option_3, row.option_4].filter(Boolean),
                    correctAnswerIndex: row.correct_answer_index,
                }));

                setLibraryQuestions(mappedQuestions);
                
                const techSet = new Set<string>();
                const skillSet = new Set<string>();
                mappedQuestions.forEach(q => {
                    if (q.technology) techSet.add(q.technology);
                    if (q.skill) skillSet.add(q.skill);
                });
                setTechnologies(Array.from(techSet).sort());
                setMasterSkills(Array.from(skillSet).sort());
            } catch (err) {
                console.error(err);
            }
            setIsLoadingLibrary(false);
        };

        fetchLibraryData();
    }, [organizerName, navigate]);

    if (!organizerName) return <PageLoader message="Loading..." />;

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            <h1 className="text-4xl font-bold text-center my-8">Create a New Quiz</h1>
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Card>
                        <label className="block text-lg font-medium text-slate-800 mb-2">Quiz Title</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-slate-100 border border-slate-300 rounded-md p-3 focus:ring-2 focus:ring-gl-orange-500 focus:outline-none"
                                placeholder="e.g., AWS Cloud Practitioner" />
                    </Card>
                    <Card>
                        <h2 className="text-xl font-bold mb-3 text-slate-800">Quiz Settings</h2>
                        <div className="space-y-3 text-slate-700">
                             <label className="flex items-center justify-between">
                                <span>Show live response counts</span>
                                <input type="checkbox" checked={quizConfig.showLiveResponseCount} onChange={e => setQuizConfig(p => ({ ...p, showLiveResponseCount: e.target.checked }))} />
                            </label>
                            <label className="flex items-center justify-between">
                                <span>Show question to players</span>
                                <input type="checkbox" checked={quizConfig.showQuestionToPlayers} onChange={e => setQuizConfig(p => ({ ...p, showQuestionToPlayers: e.target.checked }))} />
                            </label>
                        </div>
                    </Card>
                    <Card>
                        <h2 className="text-xl font-bold mb-3 text-slate-800">Your Questions ({questions.length}/10)</h2>
                        <div className="flex gap-4 mt-6">
                             <Button onClick={notAvailable} className="bg-gl-orange-600">Start Live Quiz</Button>
                        </div>
                    </Card>
                </div>
                <Card>
                    <div className="flex overflow-x-auto no-scrollbar border-b mb-4">
                         {['past', 'reports', 'library', 'custom', 'ai'].map(v => (
                             <button key={v} onClick={() => setView(v as any)} className={`py-2 px-4 font-semibold capitalize ${view === v ? 'text-gl-orange-600 border-b-2 border-gl-orange-600' : 'text-slate-500'}`}>{v}</button>
                         ))}
                    </div>
                    <div className="text-slate-500 text-center p-8">Select a tab to manage your quiz content.</div>
                </Card>
            </div>
        </div>
    );
};

export default CreateQuizPage;

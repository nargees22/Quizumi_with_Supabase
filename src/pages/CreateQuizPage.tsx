import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../service/supabase.ts";
import type { Quiz, Question, QuizConfig } from '../../types.ts';
import { GameState, QuestionType, Clan } from '../../types.ts';

import Card from '../components/Card.tsx';
import Button from '../components/Button.tsx';
import { PageLoader } from '../components/PageLoader.tsx';
import { CustomSelect } from '../components/CustomSelect.tsx';
import { LoadingSpinner } from '../icons/LoadingSpinner.tsx';
import { SearchIcon } from '../icons/SearchIcon.tsx';
import { EditIcon } from '../icons/EditIcon.tsx';
import { DeleteIcon } from '../icons/DeleteIcon.tsx';

// Helper to generate IDs like the ones in the screenshot (e.g., zfEMPK9SPQ8k643yEHz)
const generateShortId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 20; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const Toggle = ({ enabled, onChange }: { enabled: boolean, onChange: (val: boolean) => void }) => (
    <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-gl-orange-500' : 'bg-slate-200'}`}
    >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

const CreateQuizPage = () => {
    const navigate = useNavigate();
    const organizerName = useMemo(() => sessionStorage.getItem('quiz-organizer'), []);

    // Layout State
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<Array<Question>>([]);
    const [view, setView] = useState<'past' | 'reports' | 'library' | 'custom' | 'ai'>('library');
    const [isCreating, setIsCreating] = useState(false);

    // Library State
    const [libraryQuestions, setLibraryQuestions] = useState<Question[]>([]);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
    const [librarySearchTerm, setLibrarySearchTerm] = useState('');
    const [selectedTechnology, setSelectedTechnology] = useState('all');
    const [selectedSkill, setSelectedSkill] = useState('all');
    const [selectedType, setSelectedType] = useState('all');
    const [technologies, setTechnologies] = useState<string[]>([]);
    const [skills, setSkills] = useState<string[]>([]);
    const [libraryMode, setLibraryMode] = useState<'all' | 'mine'>('mine');

    // Quiz Config
    const [quizConfig, setQuizConfig] = useState<QuizConfig>({
        showLiveResponseCount: true,
        showQuestionToPlayers: true,
        clanBased: false,
        clanNames: { [Clan.TITANS]: 'Titans', [Clan.DEFENDERS]: 'Defenders' },
        clanAssignment: 'autoBalance',
    });

    // Custom Question State
    const [customQuestion, setCustomQuestion] = useState({
        text: '',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
        timeLimit: 30,
        technology: '',
        skill: '',
        type: QuestionType.MCQ,
    });
    const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);

    // 1️⃣ When the page loads: Fetch ALL questions from question_bank_structured
    useEffect(() => {
        if (!organizerName) {
            navigate('/');
            return;
        }
        fetchLibrary();
    }, [organizerName, navigate]);

    const fetchLibrary = async () => {
        setIsLoadingLibrary(true);
        try {
            const { data, error } = await supabase
                .from('question_bank_structured')
                .select('*')
                .order('creation_time', { ascending: false });

            if (error) throw error;

            const mapped: Question[] = (data || []).map((q: any) => ({
                id: q.id,
                db_pk_id: q.pk_id,
                text: q.question_text,
                options: [q.option_1, q.option_2, q.option_3, q.option_4].filter(Boolean),
                correctAnswerIndex: q.correct_answer_index,
                timeLimit: q.time_limit,
                technology: q.technology,
                skill: q.skill,
                type: q.type as QuestionType,
                organizerName: q.organizer_name
            }));

            setLibraryQuestions(mapped);

            const techSet = new Set<string>();
            const skillSet = new Set<string>();
            mapped.forEach(q => {
                if (q.technology) techSet.add(q.technology);
                if (q.skill) skillSet.add(q.skill);
            });
            setTechnologies(Array.from(techSet).sort());
            setSkills(Array.from(skillSet).sort());
        } catch (err) {
            console.error('Library fetch error:', err);
        } finally {
            setIsLoadingLibrary(false);
        }
    };

    // 5️⃣ When clicking "Add Custom"
    const handleAddCustomToLibrary = async () => {
        if (!customQuestion.text.trim() || !customQuestion.technology.trim()) {
            alert('Please fill in the question text and topic.');
            return;
        }

        setIsAddingToLibrary(true);
        try {
            const payload = {
                id: generateShortId(),
                question_text: customQuestion.text,
                time_limit: customQuestion.timeLimit,
                technology: customQuestion.technology,
                skill: customQuestion.skill,
                type: customQuestion.type,
                organizer_name: organizerName,
                option_1: customQuestion.options[0] || null,
                option_2: customQuestion.options[1] || null,
                option_3: customQuestion.options[2] || null,
                option_4: customQuestion.options[3] || null,
                correct_answer_index: customQuestion.type === QuestionType.MCQ ? customQuestion.correctAnswerIndex : null,
                creation_time: new Date().toISOString()
            };

            const { error } = await supabase
                .from('question_bank_structured')
                .insert([payload]);

            if (error) throw error;

            // Show alert: "Question added successfully!"
            alert('Question added successfully!');
            
            // Immediately refetch library
            await fetchLibrary();
            
            // Automatically switch to: Library tab, My Library sub-tab
            setCustomQuestion({ ...customQuestion, text: '', options: ['', '', '', ''], correctAnswerIndex: 0 });
            setLibraryMode('mine');
            setView('library');
        } catch (err: any) {
            console.error('Insert error:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setIsAddingToLibrary(false);
        }
    };

    const handleDeleteQuestion = async (pkId: number) => {
        if (!window.confirm("Are you sure you want to delete this question?")) return;
        try {
            const { error } = await supabase.from('question_bank_structured').delete().eq('pk_id', pkId);
            if (error) throw error;
            setLibraryQuestions(libraryQuestions.filter(q => q.db_pk_id !== pkId));
        } catch (err: any) {
            alert("Error deleting question: " + err.message);
        }
    };

    // 2️⃣ Quiz Library tab: Show ALL questions
    // 3️⃣ My Library tab: Show ONLY questions by organizer
    // 7️⃣ Filters MUST work together: Search, Type, Tech, Skill, Organizer
    const filteredLibrary = useMemo(() => {
        return libraryQuestions.filter(q => {
            // Organizer filter
            if (libraryMode === 'mine' && q.organizerName !== organizerName) return false;
            
            const matchesSearch = q.text.toLowerCase().includes(librarySearchTerm.toLowerCase()) ||
                q.technology?.toLowerCase().includes(librarySearchTerm.toLowerCase()) ||
                q.skill?.toLowerCase().includes(librarySearchTerm.toLowerCase());
            
            const matchesTech = selectedTechnology === 'all' || q.technology === selectedTechnology;
            const matchesSkill = selectedSkill === 'all' || q.skill === selectedSkill;
            const matchesType = selectedType === 'all' || q.type === selectedType;
            
            return matchesSearch && matchesTech && matchesSkill && matchesType;
        });
    }, [libraryQuestions, librarySearchTerm, selectedTechnology, selectedSkill, selectedType, libraryMode, organizerName]);

    const handleToggleQuestion = (q: Question) => {
        const exists = questions.find(item => item.id === q.id);
        if (exists) {
            setQuestions(questions.filter(item => item.id !== q.id));
        } else {
            if (questions.length < 10) {
                setQuestions([...questions, q]);
            } else {
                alert("Maximum 10 questions allowed.");
            }
        }
    };

    const handleStartLiveQuiz = async () => {
        if (!title.trim() || questions.length === 0) {
            alert("Provide a title and at least one question.");
            return;
        }
        setIsCreating(true);
        try {
            const quizId = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { error } = await supabase.from('quiz_master').insert([{
                quiz_id: quizId,
                title: title.trim(),
                organizer_name: organizerName!,
                questions: questions,
                game_state: GameState.LOBBY,
                is_draft: false,
                config: quizConfig,
                created_at: new Date().toISOString(),
            }]);
            if (error) throw error;
            navigate(`/lobby/${quizId}`);
        } catch (err) {
            console.error(err);
            alert("Failed to start quiz.");
        } finally {
            setIsCreating(false);
        }
    };

    if (!organizerName) return <PageLoader message="Loading..." />;

    return (
        <div className="p-4 sm:p-8 animate-fade-in max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold text-center my-12 text-slate-800">Create a New Quiz</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* LEFT COLUMN (Setup Panel) */}
                <div className="space-y-6">
                    <Card>
                        <label className="block text-lg font-bold text-slate-800 mb-2">Quiz Title</label>
                        <input 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 focus:ring-2 focus:ring-gl-orange-500 focus:outline-none text-lg"
                            placeholder="e.g., AWS Cloud Practitioner" 
                        />
                    </Card>

                    <Card>
                        <h2 className="text-xl font-bold mb-6 text-slate-800">Quiz Settings</h2>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-600 font-medium">Show live response counts on host screen</span>
                                <Toggle enabled={quizConfig.showLiveResponseCount} onChange={v => setQuizConfig({...quizConfig, showLiveResponseCount: v})} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-600 font-medium">Show question text on player screens</span>
                                <Toggle enabled={quizConfig.showQuestionToPlayers} onChange={v => setQuizConfig({...quizConfig, showQuestionToPlayers: v})} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-600 font-medium">Enable Clan-based teams</span>
                                <Toggle enabled={quizConfig.clanBased} onChange={v => setQuizConfig({...quizConfig, clanBased: v})} />
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <h2 className="text-xl font-bold mb-4 text-slate-800">Your Questions ({questions.length}/10)</h2>
                        <div className="min-h-[100px] flex flex-col justify-center">
                            {questions.length === 0 ? (
                                <p className="text-gl-orange-500 font-medium text-center py-4 italic">Add at least 1 question.</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {questions.map((q, i) => (
                                        <div key={q.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                                            <span className="truncate text-slate-700 font-medium"><span className="text-slate-400 mr-2">#{i+1}</span>{q.text}</span>
                                            <button type="button" onClick={() => handleToggleQuestion(q)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <Button className="bg-slate-400 cursor-not-allowed" disabled>Save Draft</Button>
                            <Button 
                                onClick={handleStartLiveQuiz} 
                                disabled={isCreating || questions.length === 0} 
                                className="bg-gl-orange-500 hover:bg-gl-orange-600 shadow-gl-orange-200 shadow-lg"
                            >
                                {isCreating ? 'Loading...' : 'Start Live Quiz'}
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* RIGHT COLUMN (Tabbed Panel) */}
                <Card className="flex flex-col min-h-[720px]">
                    <div className="flex overflow-x-auto no-scrollbar border-b mb-6">
                        {[
                            { id: 'past', label: 'My Quizzes' },
                            { id: 'reports', label: 'Reports' },
                            { id: 'library', label: 'Library' },
                            { id: 'custom', label: 'Add Custom' },
                            { id: 'ai', label: 'Generate (AI)' }
                        ].map(tab => (
                            <button 
                                key={tab.id} 
                                onClick={() => setView(tab.id as any)} 
                                className={`py-3 px-4 font-bold whitespace-nowrap transition-all border-b-2 text-sm uppercase tracking-wider ${view === tab.id ? 'text-gl-orange-600 border-gl-orange-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                        {view === 'library' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                                    <button 
                                        type="button"
                                        onClick={() => setLibraryMode('all')}
                                        className={`flex-1 py-2 rounded-md font-bold text-sm transition-all shadow-sm ${libraryMode === 'all' ? 'bg-gl-orange-500 text-white' : 'text-slate-500 hover:bg-white/50'}`}
                                    >
                                        Quiz Library
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setLibraryMode('mine')}
                                        className={`flex-1 py-2 rounded-md font-bold text-sm transition-all shadow-sm ${libraryMode === 'mine' ? 'bg-gl-orange-500 text-white' : 'text-slate-500 hover:bg-white/50'}`}
                                    >
                                        My Library
                                    </button>
                                </div>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Search by question, tech, or skill..." 
                                        value={librarySearchTerm}
                                        onChange={e => setLibrarySearchTerm(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-10 focus:ring-2 focus:ring-gl-orange-500 focus:outline-none"
                                    />
                                    <SearchIcon className="absolute left-3 top-3.5 text-slate-400 w-5 h-5" />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <CustomSelect options={Object.values(QuestionType)} value={selectedType} onChange={setSelectedType} placeholder="All Types" />
                                    <CustomSelect options={technologies} value={selectedTechnology} onChange={setSelectedTechnology} placeholder="All Technologies" />
                                    <CustomSelect options={skills} value={selectedSkill} onChange={setSelectedSkill} placeholder="All Skills" />
                                </div>
                                <div className="space-y-3 mt-4">
                                    {isLoadingLibrary ? (
                                        <div className="flex justify-center p-12"><LoadingSpinner /></div>
                                    ) : filteredLibrary.length === 0 ? (
                                        <div className="text-center py-20 text-slate-400 italic">
                                            {libraryMode === 'mine' ? "You haven't added any custom questions yet." : "No questions found."}
                                        </div>
                                    ) : (
                                        filteredLibrary.map(q => {
                                            const isSelected = questions.some(sel => sel.id === q.id);
                                            return (
                                                <div key={q.id} className="p-4 rounded-xl border border-slate-100 bg-white hover:border-gl-orange-200 transition-all shadow-sm">
                                                    <p className="font-semibold text-slate-800 mb-3">{q.text}</p>
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex gap-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{q.type}</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{q.technology}</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{q.skill}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {libraryMode === 'mine' && (
                                                                <>
                                                                    <button type="button" className="text-slate-400 hover:text-gl-orange-600 transition-colors">
                                                                        <EditIcon className="w-5 h-5" />
                                                                    </button>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => q.db_pk_id && handleDeleteQuestion(q.db_pk_id)}
                                                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <DeleteIcon className="w-5 h-5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleToggleQuestion(q)}
                                                                className={`text-xs font-bold transition-colors ${isSelected ? 'text-gl-orange-400 cursor-default' : 'text-gl-orange-600 hover:text-gl-orange-700'}`}
                                                            >
                                                                {isSelected ? '✓ Added' : '+ Add to Quiz'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {view === 'custom' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex flex-wrap gap-4 py-2 border-b border-slate-50">
                                    {Object.values(QuestionType).map(type => (
                                        <label key={type} className="flex items-center gap-2 text-slate-700 font-bold text-sm cursor-pointer group">
                                            <input 
                                                type="radio" 
                                                name="type" 
                                                checked={customQuestion.type === type} 
                                                onChange={() => setCustomQuestion({...customQuestion, type})} 
                                                className="w-4 h-4 accent-gl-orange-500"
                                            /> 
                                            <span className={customQuestion.type === type ? 'text-gl-orange-600' : ''}>{type}</span>
                                        </label>
                                    ))}
                                </div>

                                <textarea 
                                    value={customQuestion.text} 
                                    onChange={e => setCustomQuestion({...customQuestion, text: e.target.value})} 
                                    placeholder="Question / Prompt..." 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 h-32 resize-none focus:ring-2 focus:ring-gl-orange-500 focus:outline-none"
                                />

                                {(customQuestion.type === QuestionType.MCQ || customQuestion.type === QuestionType.SURVEY) && (
                                    <div className="space-y-3">
                                        {customQuestion.options.map((opt, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                {customQuestion.type === QuestionType.MCQ && (
                                                    <input 
                                                        type="radio" 
                                                        name="correct" 
                                                        checked={customQuestion.correctAnswerIndex === i} 
                                                        onChange={() => setCustomQuestion({...customQuestion, correctAnswerIndex: i})} 
                                                        className="w-5 h-5 accent-gl-orange-500"
                                                    />
                                                )}
                                                <input 
                                                    type="text" 
                                                    value={opt} 
                                                    onChange={e => {
                                                        const newOpts = [...customQuestion.options];
                                                        newOpts[i] = e.target.value;
                                                        setCustomQuestion({...customQuestion, options: newOpts});
                                                    }}
                                                    placeholder={`Option ${i + 1}`}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-gl-orange-500 focus:outline-none"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <input 
                                            type="text" 
                                            value={customQuestion.technology} 
                                            onChange={e => setCustomQuestion({...customQuestion, technology: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-gl-orange-500 focus:outline-none"
                                            placeholder="Technology (e.g., AWS)"
                                        />
                                    </div>
                                    <div>
                                        <input 
                                            type="text" 
                                            value={customQuestion.skill} 
                                            onChange={e => setCustomQuestion({...customQuestion, skill: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-gl-orange-500 focus:outline-none"
                                            placeholder="Skill (e.g., Beginner)"
                                        />
                                    </div>
                                </div>

                                <Button 
                                    onClick={handleAddCustomToLibrary} 
                                    disabled={isAddingToLibrary || !customQuestion.text.trim()} 
                                    className="bg-gl-orange-500 hover:bg-gl-orange-600 shadow-gl-orange-200 shadow-md mt-4"
                                >
                                    {isAddingToLibrary ? 'Adding...' : 'Add to Library'}
                                </Button>
                            </div>
                        )}

                        {['past', 'reports', 'ai'].includes(view) && (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-400 italic">
                                <p className="font-medium text-lg capitalize">{view} tab feature coming soon.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default CreateQuizPage;
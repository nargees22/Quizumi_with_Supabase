import React, { useState, useEffect, useRef } from 'react';

export const CustomSelect: React.FC<{
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    showPlaceholderOption?: boolean;
}> = ({ options, value, onChange, placeholder, showPlaceholderOption = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [ref]);

    const handleSelect = (option: string) => {
        onChange(option);
        setIsOpen(false);
    };

    const displayValue = value === 'all' ? placeholder : value;

    return (
        <div className="relative" ref={ref}>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-slate-100 border border-slate-300 rounded-md p-2 text-slate-900 focus:ring-2 focus:ring-gl-orange-500 focus:outline-none text-left flex justify-between items-center"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="truncate">{displayValue}</span>
                <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1">
                    <ul role="listbox" className="bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {showPlaceholderOption && (
                            <li 
                                onClick={() => handleSelect('all')}
                                className="px-3 py-2 text-slate-700 hover:bg-gl-orange-100 hover:text-gl-orange-800 cursor-pointer"
                                role="option"
                                aria-selected={value === 'all'}
                            >
                                {placeholder}
                            </li>
                        )}
                        {options.map(option => (
                            <li 
                                key={option} 
                                onClick={() => handleSelect(option)}
                                className="px-3 py-2 text-slate-700 hover:bg-gl-orange-100 hover:text-gl-orange-800 cursor-pointer overflow-x-auto whitespace-nowrap custom-scrollbar"
                                role="option"
                                aria-selected={value === option}
                            >
                                {option}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
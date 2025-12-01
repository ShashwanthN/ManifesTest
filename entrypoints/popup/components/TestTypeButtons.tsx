import React from 'react';

export type TestType = 'mcq' | 'true_false' | 'fill_in';

interface TestTypeButtonsProps {
  selectedTypes: Set<TestType>;
  onToggleType: (type: TestType) => void;
}

const TestTypeButtons: React.FC<TestTypeButtonsProps> = ({ selectedTypes, onToggleType }) => {
  const testTypes: { type: TestType; label: string }[] = [
    { type: 'mcq', label: 'Choose' },
    { type: 'true_false', label: 'True/ False' },
    { type: 'fill_in', label: 'Fill In' },
  ];

  return (
    <div className="flex flex-col gap-1">
      {testTypes.map(({ type, label }) => {
        const isSelected = selectedTypes.has(type);
        return (
          <button
            key={type}
            onClick={() => onToggleType(type)}
            className={`
              px-3 py-1 text-[12px] transition-all rounded-lg font-medium
              ${isSelected
                ? 'bg-[#E6D9FF] text-black border-none'
                : 'bg-[#2A2A2A] text-[#C9B3FF] border border-[#968EF3]'
              }
              hover:opacity-90 whitespace-nowrap 
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default TestTypeButtons;

import { Home, Save, ArrowLeft } from 'lucide-react';
import { Question } from '../utils/testGeneration';

interface TestPageProps {
  testData: any;
  currentQuestion: number;
  userAnswers: any;
  timeLeft: number;
  isSaving: boolean;
  formatTime: (seconds: number) => string;
  onGoHome: () => void;
  onSaveTest: () => void;
  onAnswerSelect: (questionIndex: number, value: any) => void;
  onPreviousQuestion: () => void;
  onNextQuestion: () => void;
  onGoToQuestion: (index: number) => void;
  onSubmitTest: () => void;
}

export default function TestPage({
  testData,
  currentQuestion,
  userAnswers,
  timeLeft,
  isSaving,
  formatTime,
  onGoHome,
  onSaveTest,
  onAnswerSelect,
  onPreviousQuestion,
  onNextQuestion,
  onGoToQuestion,
  onSubmitTest
}: TestPageProps) {
  const question: Question = testData.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / testData.questions.length) * 100;
  const answeredQuestions = Object.keys(userAnswers).length;

  return (
    <div className="w-full h-full bg-[#1A1A1A] flex flex-col relative" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className='border-b border-neutral-800'>
        {/* Top Row - Main Info */}
        <div className='flex items-center justify-between px-4 py-2'>
          <button
            onClick={onGoHome}
            className='w-8 h-8 flex items-center justify-center hover:bg-[#2A2A2A] rounded-lg transition-colors shrink-0'
          >
            <Home className='w-4 h-4 text-neutral-400' />
          </button>
          <div className='flex-1 flex flex-col items-center gap-1 mx-3 min-w-0'>
            <div className='text-sm text-neutral-300 font-medium font-serif whitespace-nowrap'>
              Question {currentQuestion + 1} of {testData.questions.length}
            </div>
            <div className='w-full max-w-[200px] h-1 bg-neutral-800 rounded-full overflow-hidden'>
              <div 
                className='h-full bg-yellow-500 transition-all duration-300'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className='text-yellow-500 font-bold text-lg whitespace-nowrap shrink-0'>{formatTime(timeLeft)}</div>
        </div>
        
        {/* Bottom Row - Secondary Info */}
        <div className='flex items-center justify-between px-4 py-1.5 border-t border-neutral-800'>
          <div className='text-xs text-neutral-500'>
            {answeredQuestions} of {testData.questions.length} answered
          </div>
          <button
            onClick={onSaveTest}
            disabled={isSaving}
            className='px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs rounded transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0'
          >
            <Save className='w-3 h-3' />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Question Content */}
      <div className='flex-1 flex flex-col px-6 py-4 overflow-y-auto'>
        <div className='w-full max-w-2xl mx-auto space-y-6'>
          <div className='flex items-start gap-3'>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              userAnswers[currentQuestion] !== undefined 
                ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50' 
                : 'bg-neutral-700 text-neutral-400 border-2 border-neutral-600'
            }`}>
              {currentQuestion + 1}
            </div>
            <h2 className='text-lg text-white font-medium font-serif leading-relaxed flex-1 pt-'>
              {question.question}
            </h2>
          </div>

          {/* MCQ Question */}
          {question.type === 'mcq' && question.options && (
            <div className='space-y-2.5'>
              {question.options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => onAnswerSelect(currentQuestion, idx)}
                  className={`w-full p-3.5 rounded-xl text-left transition-all ${
                    userAnswers[currentQuestion] === idx
                      ? 'bg-yellow-500 text-black font-medium'
                      : 'bg-[#202020] text-neutral-300 hover:bg-[#2A2A2A] border border-transparent hover:border-neutral-600'
                  }`}
                >
                  <span className='font-bold mr-3 text-base'>{String.fromCharCode(65 + idx)}.</span>
                  <span className='text-sm'>{option}</span>
                </button>
              ))}
            </div>
          )}

          {/* True/False Question */}
          {question.type === 'true_false' && (
            <div className='space-y-2.5'>
              <button
                onClick={() => onAnswerSelect(currentQuestion, true)}
                className={`w-full p-3.5 rounded-xl text-left transition-all ${
                  userAnswers[currentQuestion] === true
                    ? 'bg-yellow-500 text-black font-medium'
                    : 'bg-[#202020] text-neutral-300 hover:bg-[#2A2A2A] border border-transparent hover:border-neutral-600'
                }`}
              >
                <span className='text-base font-medium'>True</span>
              </button>
              <button
                onClick={() => onAnswerSelect(currentQuestion, false)}
                className={`w-full p-3.5 rounded-xl text-left transition-all ${
                  userAnswers[currentQuestion] === false
                    ? 'bg-yellow-500 text-black font-medium'
                    : 'bg-[#202020] text-neutral-300 hover:bg-[#2A2A2A] border border-transparent hover:border-neutral-600'
                }`}
              >
                <span className='text-base font-medium'>False</span>
              </button>
            </div>
          )}

          {/* Fill In Question */}
          {question.type === 'fill_in' && (
            <div className='space-y-2.5'>
              <input
                type="text"
                value={userAnswers[currentQuestion] || ''}
                onChange={(e) => onAnswerSelect(currentQuestion, e.target.value)}
                placeholder='Type your answer...'
                className='w-full p-3.5 rounded-xl bg-[#202020] text-white placeholder-neutral-500 border border-neutral-700 focus:border-yellow-500 focus:outline-none text-sm'
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className='flex flex-col gap-3 px-6 py-3 border-t border-neutral-800 bg-[#1A1A1A]'>
        <div className='flex justify-between items-center'>
          <button
            onClick={onPreviousQuestion}
            disabled={currentQuestion === 0}
            className='px-5 py-2 bg-neutral-700 text-white rounded-full disabled:opacity-50 border border-transparent disabled:cursor-not-allowed hover:bg-neutral-600 transition-colors flex items-center gap-2 text-sm'
          >
            <ArrowLeft className='w-4 h-4' />
            Previous
          </button>
          
          <button
            onClick={() => {
              if (currentQuestion === testData.questions.length - 1) {
                onSubmitTest();
              } else {
                onNextQuestion();
              }
            }}
            className='px-5 py-2 bg-yellow-500 font-serif text-black font-light rounded-full border border-yellow-500 hover:border-yellow-500 hover:border hover:bg-yellow-900 hover:text-white transition-colors flex items-center gap-2 text-sm'
          >
            {currentQuestion === testData.questions.length - 1 ? 'Submit Test' : 'Next'}
            {currentQuestion !== testData.questions.length - 1 && (
              <ArrowLeft className='w-4 h-4 rotate-180' />
            )}
          </button>
        </div>
        
        <div className='flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent'>
          {testData.questions.map((_: any, idx: number) => (
            <button
              key={idx}
              onClick={() => onGoToQuestion(idx)}
              className={`shrink-0 w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                idx === currentQuestion
                  ? 'bg-yellow-500 text-black'
                  : userAnswers[idx] !== undefined
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

